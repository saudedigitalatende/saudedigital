-- Catálogo de Serviços — usuários autorizados e políticas RLS
-- Execute este arquivo no SQL Editor do projeto Supabase.

begin;

create extension if not exists pgcrypto;

create table if not exists public.catalogo_usuarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  nome text not null,
  perfil text not null check (perfil in ('ADMINISTRADOR', 'EDITOR', 'LEITOR')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint catalogo_usuarios_email_institucional
    check (lower(email) ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@recife\.pe\.gov\.br$')
);

create unique index if not exists catalogo_usuarios_email_lower_uidx
  on public.catalogo_usuarios (lower(email));

-- Garante que user_id e e-mail sempre correspondam ao mesmo usuário do Supabase Auth.
create or replace function public.catalogo_validar_identidade()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_email text;
begin
  select lower(u.email) into auth_email
  from auth.users u
  where u.id = new.user_id;

  if auth_email is null then
    raise exception 'Usuário não encontrado no Supabase Auth';
  end if;
  if auth_email <> lower(new.email) then
    raise exception 'O e-mail deve corresponder ao user_id do Supabase Auth';
  end if;
  return new;
end;
$$;

revoke all on function public.catalogo_validar_identidade() from public;

drop trigger if exists catalogo_usuarios_validar_identidade on public.catalogo_usuarios;
create trigger catalogo_usuarios_validar_identidade
before insert or update of user_id, email on public.catalogo_usuarios
for each row execute function public.catalogo_validar_identidade();

-- Função SECURITY DEFINER evita recursão nas políticas da própria tabela.
create or replace function public.catalogo_usuario_eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.catalogo_usuarios cu
    where cu.user_id = auth.uid()
      and cu.ativo = true
      and cu.perfil = 'ADMINISTRADOR'
  );
$$;

revoke all on function public.catalogo_usuario_eh_admin() from public;
grant execute on function public.catalogo_usuario_eh_admin() to authenticated, service_role;

alter table public.catalogo_usuarios enable row level security;
alter table public.catalogo_usuarios force row level security;

drop policy if exists catalogo_usuarios_ler_proprio on public.catalogo_usuarios;
create policy catalogo_usuarios_ler_proprio
on public.catalogo_usuarios
for select
to authenticated
using (user_id = auth.uid() or public.catalogo_usuario_eh_admin());

drop policy if exists catalogo_usuarios_admin_inserir on public.catalogo_usuarios;
create policy catalogo_usuarios_admin_inserir
on public.catalogo_usuarios
for insert
to authenticated
with check (public.catalogo_usuario_eh_admin());

drop policy if exists catalogo_usuarios_admin_atualizar on public.catalogo_usuarios;
create policy catalogo_usuarios_admin_atualizar
on public.catalogo_usuarios
for update
to authenticated
using (public.catalogo_usuario_eh_admin())
with check (public.catalogo_usuario_eh_admin());

drop policy if exists catalogo_usuarios_admin_excluir on public.catalogo_usuarios;
create policy catalogo_usuarios_admin_excluir
on public.catalogo_usuarios
for delete
to authenticated
using (public.catalogo_usuario_eh_admin());

revoke all on table public.catalogo_usuarios from anon;
grant select, insert, update, delete on table public.catalogo_usuarios to authenticated;
grant all on table public.catalogo_usuarios to service_role;

commit;

-- PRIMEIRO ADMINISTRADOR
-- 1. No painel Supabase, crie/convide o usuário em Authentication > Users.
-- 2. Copie o UUID do usuário e execute, substituindo os valores abaixo:
--
-- insert into public.catalogo_usuarios (user_id, email, nome, perfil, ativo)
-- values (
--   'UUID_DO_USUARIO_AUTH',
--   'seu.email@recife.pe.gov.br',
--   'Seu nome',
--   'ADMINISTRADOR',
--   true
-- );
