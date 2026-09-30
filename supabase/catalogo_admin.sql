begin;

create extension if not exists pgcrypto;

create table if not exists public.catalogo_areas (
  id uuid primary key default gen_random_uuid(), nome text not null unique,
  slug text not null unique, ordem integer not null default 0, ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.catalogo_categorias (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references public.catalogo_areas(id),
  nome text not null, icone text, ordem integer not null default 0, ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(area_id,nome)
);
create table if not exists public.catalogo_servicos (
  id uuid primary key default gen_random_uuid(), categoria_id uuid not null references public.catalogo_categorias(id),
  numero integer, nome text not null, responsavel text, grupo_tecnico text, icone text,
  ativo boolean not null default true, ordem integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(categoria_id,nome)
);
create table if not exists public.catalogo_solicitacoes (
  id uuid primary key default gen_random_uuid(), servico_id uuid not null references public.catalogo_servicos(id) on delete cascade,
  tipo text, solicitacao text not null, sla text, n1 text, n2 text, n3 text, conceito text,
  ativo boolean not null default true, ordem integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.catalogo_documentos (
  id uuid primary key default gen_random_uuid(), servico_id uuid not null references public.catalogo_servicos(id) on delete cascade,
  nome text not null, tipo text, versao text, url text, arquivo_path text,
  ativo boolean not null default true, ordem integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.catalogo_historico (
  id bigint generated always as identity primary key, usuario_id uuid, usuario_email text,
  acao text not null, entidade text not null, registro_id text,
  dados_anteriores jsonb, dados_novos jsonb, data_hora timestamptz not null default now()
);

create or replace function public.catalogo_pode_editar() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.catalogo_usuarios where user_id=auth.uid() and ativo and perfil in ('ADMINISTRADOR','EDITOR'));
$$;
revoke all on function public.catalogo_pode_editar() from public;
grant execute on function public.catalogo_pode_editar() to authenticated, anon;

create or replace function public.catalogo_auditar() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.catalogo_historico(usuario_id,usuario_email,acao,entidade,registro_id,dados_anteriores,dados_novos)
 values(auth.uid(),auth.jwt()->>'email',tg_op, tg_table_name, coalesce(new.id,old.id)::text,
   case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
   case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
 return coalesce(new,old);
end; $$;
revoke all on function public.catalogo_auditar() from public;

create or replace function public.catalogo_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['catalogo_areas','catalogo_categorias','catalogo_servicos','catalogo_solicitacoes','catalogo_documentos'] loop
  execute format('drop trigger if exists %I_updated_at on public.%I',t,t);
  execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.catalogo_updated_at()',t,t);
  execute format('drop trigger if exists %I_auditoria on public.%I',t,t);
  execute format('create trigger %I_auditoria after insert or update or delete on public.%I for each row execute function public.catalogo_auditar()',t,t);
 end loop;
end $$;

do $$ declare t text; begin
 foreach t in array array['catalogo_areas','catalogo_categorias','catalogo_servicos','catalogo_solicitacoes','catalogo_documentos','catalogo_historico'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

do $$ declare t text; begin
 foreach t in array array['catalogo_areas','catalogo_categorias','catalogo_servicos','catalogo_solicitacoes','catalogo_documentos'] loop
  execute format('drop policy if exists %I_publicar on public.%I',t,t);
  execute format('create policy %I_publicar on public.%I for select using (ativo=true or public.catalogo_pode_editar())',t,t);
  execute format('drop policy if exists %I_editar on public.%I',t,t);
  execute format('create policy %I_editar on public.%I for all to authenticated using (public.catalogo_pode_editar()) with check (public.catalogo_pode_editar())',t,t);
 end loop;
end $$;
drop policy if exists catalogo_historico_ler on public.catalogo_historico;
create policy catalogo_historico_ler on public.catalogo_historico for select to authenticated using(public.catalogo_pode_editar());

grant select on public.catalogo_areas,public.catalogo_categorias,public.catalogo_servicos,public.catalogo_solicitacoes,public.catalogo_documentos to anon,authenticated;
grant insert,update,delete on public.catalogo_areas,public.catalogo_categorias,public.catalogo_servicos,public.catalogo_solicitacoes,public.catalogo_documentos to authenticated;
grant select on public.catalogo_historico to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('catalogo-documentos','catalogo-documentos',true,52428800)
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit;
drop policy if exists catalogo_documentos_publicos on storage.objects;
create policy catalogo_documentos_publicos on storage.objects for select using(bucket_id='catalogo-documentos');
drop policy if exists catalogo_documentos_editores_inserir on storage.objects;
create policy catalogo_documentos_editores_inserir on storage.objects for insert to authenticated with check(bucket_id='catalogo-documentos' and public.catalogo_pode_editar());
drop policy if exists catalogo_documentos_editores_atualizar on storage.objects;
create policy catalogo_documentos_editores_atualizar on storage.objects for update to authenticated using(bucket_id='catalogo-documentos' and public.catalogo_pode_editar());
drop policy if exists catalogo_documentos_editores_excluir on storage.objects;
create policy catalogo_documentos_editores_excluir on storage.objects for delete to authenticated using(bucket_id='catalogo-documentos' and public.catalogo_pode_editar());

commit;
