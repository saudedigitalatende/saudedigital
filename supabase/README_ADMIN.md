# Ativação da área administrativa

No **SQL Editor** do projeto Supabase, execute nesta ordem:

1. `catalogo_auth.sql` (caso ainda não tenha sido executado);
2. `catalogo_admin.sql` (tabelas, RLS, auditoria e bucket);
3. `catalogo_seed.sql` (carga dos 85 serviços, 582 solicitações e 33 documentos atuais).

Depois, em **Authentication → Users**, crie ou convide o usuário institucional. Copie o UUID dele e cadastre o primeiro administrador pelo SQL Editor:

```sql
insert into public.catalogo_usuarios (user_id, email, nome, perfil, ativo)
values ('UUID_DO_AUTH_USERS', 'usuario@recife.pe.gov.br', 'Nome do usuário', 'ADMINISTRADOR', true);
```

Em **Authentication → URL Configuration**, inclua:

- Site URL: `https://saudedigitalatende.github.io/saudedigital/`
- Redirect URL: `https://saudedigitalatende.github.io/saudedigital/**`

O bucket `catalogo-documentos` é criado automaticamente por `catalogo_admin.sql`. Não é necessário criá-lo manualmente.

Após o login, acesse `/saudedigital/admin/`. Administradores também podem abrir `/saudedigital/admin/usuarios.html`.
