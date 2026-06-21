-- ============================================================
-- Edição de perfil pelo próprio usuário: nome e foto (avatar)
--
-- 1. Adiciona a coluna `avatar_url` em `profiles`.
-- 2. Garante uma policy de UPDATE para o próprio usuário editar
--    seu profile (nome/avatar). É idempotente e não interfere na
--    policy administrativa de 0002 (policies de UPDATE combinam com OR).
-- 3. Cria o bucket público `avatars` no Storage e as policies para
--    cada usuário gerenciar apenas os arquivos da sua própria pasta.
-- ============================================================

-- 1. Coluna de avatar -----------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Self-update de profile -----------------------------------
alter table public.profiles enable row level security;

drop policy if exists "users_update_own_profile" on public.profiles;
create policy "users_update_own_profile" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3. Bucket de avatars ----------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Leitura pública dos avatars.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Cada usuário só escreve/atualiza/remove arquivos na sua pasta:
-- o caminho deve começar com "<user_id>/...".
drop policy if exists "avatars_user_insert" on storage.objects;
create policy "avatars_user_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_update" on storage.objects;
create policy "avatars_user_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_delete" on storage.objects;
create policy "avatars_user_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
