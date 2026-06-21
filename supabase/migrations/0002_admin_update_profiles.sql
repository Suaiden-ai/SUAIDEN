-- ============================================================
-- Permitir que administradores alterem o role de qualquer profile
--
-- Problema: a tabela `profiles` tem RLS habilitado, mas não há
-- policy de UPDATE que permita um admin editar OUTRO usuário.
-- Sem ela, o UPDATE retorna sucesso com 0 linhas (RLS filtra a
-- linha), então a UI parece mudar mas o banco não persiste.
--
-- Cuidado: uma policy em `profiles` que faça SELECT em `profiles`
-- para checar o role causa RECURSÃO infinita. Por isso usamos uma
-- função SECURITY DEFINER, que lê o role ignorando o RLS.
-- ============================================================

-- 1. Função auxiliar: retorna true se o usuário atual é admin.
--    SECURITY DEFINER + search_path fixo evita recursão de policy.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 2. Garantir que o RLS está habilitado na tabela.
alter table public.profiles enable row level security;

-- 3. Policy de UPDATE: admins podem atualizar qualquer profile.
drop policy if exists "admins_update_profiles" on public.profiles;
create policy "admins_update_profiles" on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Observação: usuários comuns continuam regidos pelas policies já
-- existentes (ex.: cada um editar o próprio profile). Esta policy
-- apenas ADICIONA a permissão administrativa; policies de UPDATE são
-- combinadas com OR no Postgres.
