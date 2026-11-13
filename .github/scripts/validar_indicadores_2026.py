
#!/usr/bin/env python3
"""Valida o JSON público de indicadores agregados do dashboard GTIC 2026.

O módulo usa somente a biblioteca padrão do Python. Ele pode ser importado pelos
testes ou executado diretamente:

    python .github/scripts/validar_indicadores_2026.py caminho/indicadores_2026.json

Código de saída 0 indica um arquivo válido; código 1 indica reprovação.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any, NoReturn


MAX_JSON_BYTES = 32 * 1024
MAX_SAFE_INTEGER = 9_007_199_254_740_991
SCHEMA_VERSION = 1
EXPECTED_SOURCE = "n8n-glpi-aggregated"

TECHNICAL_GROUPS = (
    "INFRAESTRUTURA",
    "SISTEMAS",
    "GOVERNANÇA",
    "DISPOSITIVOS MÓVEIS",
)
EXPECTED_GROUPS = frozenset((*TECHNICAL_GROUPS, "GERAL"))
ISO_8601_TIMESTAMP = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?"
    r"(?:Z|(?P<offset_sign>[+-])(?P<offset_hour>\d{2}):(?P<offset_minute>\d{2}))$"
)

TOP_LEVEL_KEYS = frozenset({"schemaVersion", "updatedAt", "source", "records"})
COUNTER_FIELDS = (
    "totalChamados",
    "backlog",
    "encerrados",
    "semSLA",
    "abertosDentroSLA",
    "abertosSlaVencido",
    "encerradosDentroSLA",
    "encerradosSlaVencido",
    "chamadosComSLA",
)
RECORD_KEYS = frozenset({"grupo", *COUNTER_FIELDS, "slaGlobal"})


class ValidationError(ValueError):
    """Erro de validação seguro para apresentação em logs de automação."""


def _fail(message: str) -> NoReturn:
    raise ValidationError(message)


def _require_exact_keys(value: dict[str, Any], expected: frozenset[str], context: str) -> None:
    received = set(value)
    missing = sorted(expected - received)
    extra = sorted(received - expected)
    if missing:
        _fail(f"{context}: campos obrigatórios ausentes: {', '.join(missing)}")
    if extra:
        _fail(
            f"{context}: campos não permitidos: {', '.join(extra)}. "
            "O arquivo público aceita somente indicadores agregados."
        )


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            _fail(f"JSON contém a chave duplicada: {key}")
        result[key] = value
    return result


def _reject_non_standard_number(value: str) -> NoReturn:
    _fail(f"JSON contém número não permitido: {value}")


def _validate_timestamp(value: Any) -> None:
    if not isinstance(value, str) or not value:
        _fail("updatedAt deve ser uma data e hora ISO 8601 em formato textual")

    timestamp_match = ISO_8601_TIMESTAMP.fullmatch(value)
    if timestamp_match is None:
        _fail(
            "updatedAt deve seguir o formato ISO 8601 completo, "
            "informar o fuso horário e usar, por exemplo, "
            "2026-11-11T12:00:00-03:00 ou o sufixo Z"
        )

    # O ISO 8601 admite deslocamentos com horas de 00 a 23 e minutos de 00 a 59.
    # A validação explícita evita que normalizações permissivas aceitem, por
    # exemplo, +00:60 como se fosse +01:00.
    if timestamp_match.group("offset_sign") is not None:
        offset_hour = int(timestamp_match.group("offset_hour"))
        offset_minute = int(timestamp_match.group("offset_minute"))
        if offset_hour > 23 or offset_minute > 59:
            _fail(
                "updatedAt contém um deslocamento de fuso horário inválido; "
                "use horas entre 00 e 23 e minutos entre 00 e 59"
            )

    normalized = value
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        timestamp = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValidationError("updatedAt não contém uma data e hora ISO 8601 válida") from exc

    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        _fail("updatedAt deve informar o fuso horário, por exemplo -03:00 ou Z")


def _validate_counter(value: Any, field: str, group: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        _fail(f"{group}.{field} deve ser um número inteiro")
    if value < 0:
        _fail(f"{group}.{field} não pode ser negativo")
    if value > MAX_SAFE_INTEGER:
        _fail(
            f"{group}.{field} não pode ser superior ao maior inteiro seguro "
            f"do JavaScript ({MAX_SAFE_INTEGER})"
        )
    return value


def _validate_sla(value: Any, record: dict[str, Any], group: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        _fail(f"{group}.slaGlobal deve ser numérico")

    try:
        sla_decimal = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValidationError(f"{group}.slaGlobal deve ser numérico") from exc

    if not sla_decimal.is_finite() or not Decimal("0") <= sla_decimal <= Decimal("100"):
        _fail(f"{group}.slaGlobal deve estar entre 0 e 100")

    with_sla = record["chamadosComSLA"]
    within_sla = record["abertosDentroSLA"] + record["encerradosDentroSLA"]
    expected = (
        Decimal("0.0")
        if with_sla == 0
        else (Decimal(within_sla) * Decimal(100) / Decimal(with_sla)).quantize(
            Decimal("0.1"), rounding=ROUND_HALF_UP
        )
    )

    # O n8n publica o percentual arredondado explicitamente para uma casa decimal.
    # A comparação é exata para impedir que 69,2 seja aceito quando o correto é 69,3.
    if sla_decimal != expected:
        _fail(
            f"{group}.slaGlobal ({sla_decimal}) não confere com o percentual "
            f"arredondado para uma casa decimal ({expected})"
        )
    return float(sla_decimal)


def _validate_record(value: Any, position: int) -> dict[str, Any]:
    context = f"records[{position}]"
    if not isinstance(value, dict):
        _fail(f"{context} deve ser um objeto JSON")

    _require_exact_keys(value, RECORD_KEYS, context)

    group = value["grupo"]
    if not isinstance(group, str) or group not in EXPECTED_GROUPS:
        _fail(f"{context}.grupo não é reconhecido: {group!r}")

    normalized: dict[str, Any] = {"grupo": group}
    for field in COUNTER_FIELDS:
        normalized[field] = _validate_counter(value[field], field, group)

    if normalized["totalChamados"] != normalized["backlog"] + normalized["encerrados"]:
        _fail(f"{group}: totalChamados deve ser igual a backlog + encerrados")

    if normalized["totalChamados"] != normalized["semSLA"] + normalized["chamadosComSLA"]:
        _fail(f"{group}: totalChamados deve ser igual a semSLA + chamadosComSLA")

    sla_distribution = (
        normalized["abertosDentroSLA"]
        + normalized["abertosSlaVencido"]
        + normalized["encerradosDentroSLA"]
        + normalized["encerradosSlaVencido"]
    )
    if normalized["chamadosComSLA"] != sla_distribution:
        _fail(f"{group}: a distribuição de SLA não confere com chamadosComSLA")

    open_with_sla = normalized["abertosDentroSLA"] + normalized["abertosSlaVencido"]
    if open_with_sla > normalized["backlog"]:
        _fail(f"{group}: chamados abertos com SLA não podem ultrapassar o backlog")

    closed_with_sla = (
        normalized["encerradosDentroSLA"] + normalized["encerradosSlaVencido"]
    )
    if closed_with_sla > normalized["encerrados"]:
        _fail(f"{group}: chamados encerrados com SLA não podem ultrapassar encerrados")

    normalized["slaGlobal"] = _validate_sla(value["slaGlobal"], normalized, group)
    return normalized


def validate_document(document: Any) -> dict[str, Any]:
    """Valida e devolve uma representação normalizada do documento."""

    if not isinstance(document, dict):
        _fail("A raiz do JSON deve ser um objeto")

    _require_exact_keys(document, TOP_LEVEL_KEYS, "raiz")

    version = document["schemaVersion"]
    if isinstance(version, bool) or not isinstance(version, int) or version != SCHEMA_VERSION:
        _fail(f"schemaVersion deve ser o número inteiro {SCHEMA_VERSION}")

    _validate_timestamp(document["updatedAt"])

    if document["source"] != EXPECTED_SOURCE:
        _fail(f"source deve ser exatamente {EXPECTED_SOURCE!r}")

    records = document["records"]
    if not isinstance(records, list):
        _fail("records deve ser uma lista")
    if len(records) != len(EXPECTED_GROUPS):
        _fail("records deve conter exatamente os quatro grupos técnicos e o consolidado GERAL")

    normalized_records = [_validate_record(record, index) for index, record in enumerate(records)]
    groups = [record["grupo"] for record in normalized_records]

    if len(set(groups)) != len(groups):
        _fail("records contém grupos duplicados")
    if set(groups) != EXPECTED_GROUPS:
        missing = sorted(EXPECTED_GROUPS - set(groups))
        extra = sorted(set(groups) - EXPECTED_GROUPS)
        details = []
        if missing:
            details.append(f"ausentes: {', '.join(missing)}")
        if extra:
            details.append(f"não reconhecidos: {', '.join(extra)}")
        _fail("Conjunto de grupos inválido (" + "; ".join(details) + ")")

    by_group = {record["grupo"]: record for record in normalized_records}
    general = by_group["GERAL"]
    for field in COUNTER_FIELDS:
        calculated = sum(by_group[group][field] for group in TECHNICAL_GROUPS)
        if general[field] != calculated:
            _fail(f"GERAL.{field} deve ser a soma dos quatro grupos técnicos ({calculated})")

    return {
        "schemaVersion": SCHEMA_VERSION,
        "updatedAt": document["updatedAt"],
        "source": EXPECTED_SOURCE,
        "records": normalized_records,
    }


def validate_bytes(raw: bytes) -> dict[str, Any]:
    """Valida tamanho, codificação, sintaxe e conteúdo de um JSON em bytes."""

    if len(raw) > MAX_JSON_BYTES:
        _fail(f"O JSON excede o limite de {MAX_JSON_BYTES} bytes (32 KB)")

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValidationError("O arquivo deve estar codificado em UTF-8") from exc

    try:
        document = json.loads(
            text,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_standard_number,
        )
    except json.JSONDecodeError as exc:
        raise ValidationError(
            f"JSON inválido na linha {exc.lineno}, coluna {exc.colno}: {exc.msg}"
        ) from exc

    return validate_document(document)


def validate_file(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as handle:
            raw = handle.read(MAX_JSON_BYTES + 1)
    except OSError as exc:
        raise ValidationError(f"Não foi possível ler o arquivo: {exc}") from exc
    return validate_bytes(raw)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"Uso: {Path(argv[0]).name} ARQUIVO_JSON", file=sys.stderr)
        return 1

    path = Path(argv[1])
    try:
        document = validate_file(path)
    except ValidationError as exc:
        print(f"REPROVADO: {exc}", file=sys.stderr)
        return 1

    print(
        "APROVADO: JSON agregado válido "
        f"({len(document['records'])} registros, {path.stat().st_size} bytes)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
