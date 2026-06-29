-- ============================================================
-- Sistema de NOTIFICAÇÕES internas (notifications)
--
-- Notificações in-app por usuário (sino no header + toast em
-- tempo real). Dois tipos de evento são gerados hoje:
--
--   'new_ticket'      → um novo chamado entrou em um quadro;
--                       enviado aos DESENVOLVEDORES membros do
--                       quadro (board_members com role developer).
--   'task_completed'  → uma tarefa foi concluída (is_done = true);
--                       enviado ao CLIENTE (boards.owner_id) e a
--                       todos os ADMINS.
--
-- Cada linha é endereçada a UM destinatário (`recipient_id`), o
-- que torna a leitura/contagem de não-lidas trivial por usuário.
-- O campo `metadata` (jsonb) guarda contexto livre por tipo.
--
-- As notificações são criadas pelo front-end (helper
-- src/lib/notifications.ts) e pela Edge Function `create-task`
-- (que usa a service role e ignora o RLS).
-- ============================================================

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  -- destinatário da notificação
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  -- tipo do evento: 'new_ticket' | 'task_completed'
  type          text not null,
  -- conteúdo legível
  title         text not null,
  body          text,
  -- contexto opcional (objetos podem ser deletados depois)
  board_id      uuid references public.boards(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete set null,
  -- quem disparou o evento (para exibir "por Fulano")
  actor_id      uuid references public.profiles(id) on delete set null,
  actor_name    text,
  -- contexto livre por tipo de evento
  metadata      jsonb not null default '{}'::jsonb,
  -- nulo enquanto não lida
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_notifications_recipient
  on public.notifications(recipient_id, created_at desc);
-- contagem rápida de não-lidas por usuário
create index if not exists idx_notifications_unread
  on public.notifications(recipient_id) where read_at is null;

-- ── RLS ──
alter table public.notifications enable row level security;

-- SELECT: o usuário lê apenas as próprias notificações.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select
  using (recipient_id = auth.uid());

-- INSERT: qualquer usuário autenticado pode criar notificações para
-- outros (ex.: dev conclui task → notifica cliente/admins). O actor,
-- quando informado, deve ser o próprio usuário. A Edge Function usa a
-- service role e não passa por esta policy.
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert
  with check (
    auth.uid() is not null
    and (actor_id is null or actor_id = auth.uid())
  );

-- UPDATE: o destinatário pode marcar a própria notificação como lida.
-- (a checagem de colunas alteradas é responsabilidade do app; aqui
--  garantimos apenas que só o dono mexe na própria linha)
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- DELETE: o destinatário pode remover as próprias notificações.
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete
  using (recipient_id = auth.uid());

-- ── Realtime ──
-- Habilita a tabela na publicação de realtime para que o sino e o
-- toast atualizem ao vivo. Ignora erro se já estiver na publicação.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null; -- publicação não existe neste ambiente
end $$;
