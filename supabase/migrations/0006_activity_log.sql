-- ============================================================
-- Sistema completo de LOGS de projeto (activity_log)
--
-- Registra TODAS as ações relevantes feitas dentro de um quadro
-- (board): criação/edição/exclusão de cards, comentários, uploads,
-- movimentação entre colunas, conclusão/reabertura, mudanças de
-- coluna, membros, etc.
--
-- Diferente de `task_activity` (migration 0001) — que só cobre um
-- conjunto restrito de métricas — esta tabela é a fonte única e
-- abrangente para a página de logs do projeto (/admin/boards/:id/logs).
--
-- O log é gravado pelo front-end nos pontos de mutação. O campo
-- `metadata` (jsonb) guarda contexto livre por tipo de evento
-- (título do card, nome do arquivo, trecho do comentário, etc).
-- ============================================================

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards(id) on delete cascade,
  -- contexto opcional (o objeto pode ter sido deletado depois)
  task_id     uuid references public.tasks(id) on delete set null,
  column_id   uuid references public.columns(id) on delete set null,
  -- quem fez a ação
  actor_id    uuid references public.profiles(id) on delete set null,
  -- nome no momento da ação (sobrevive à exclusão do perfil)
  actor_name  text,
  -- tipo de entidade afetada: 'card' | 'comment' | 'attachment'
  --                           | 'column' | 'member' | 'board'
  entity_type text not null,
  -- ação: 'created' | 'updated' | 'deleted' | 'moved' | 'completed'
  --       | 'reopened' | 'commented' | 'comment_deleted'
  --       | 'uploaded' | 'attachment_deleted' | 'renamed'
  --       | 'assigned' | 'unassigned' | 'member_added'
  --       | 'member_removed' | 'archived' | 'restored' | ...
  action      text not null,
  -- rótulo legível do objeto no momento (ex.: título do card)
  entity_label text,
  -- contexto livre por tipo de evento
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_log_board   on public.activity_log(board_id, created_at desc);
create index if not exists idx_activity_log_task    on public.activity_log(task_id);
create index if not exists idx_activity_log_actor   on public.activity_log(actor_id);
create index if not exists idx_activity_log_action  on public.activity_log(action);
create index if not exists idx_activity_log_entity  on public.activity_log(entity_type);
create index if not exists idx_activity_log_created on public.activity_log(created_at desc);

-- ── RLS ──
alter table public.activity_log enable row level security;

-- SELECT: admin, dono ou membro do board podem ler os logs.
drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.boards b
      where b.id = activity_log.board_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.board_members bm
      where bm.board_id = activity_log.board_id and bm.user_id = auth.uid()
    )
  );

-- INSERT: usuário autenticado que seja admin/dono/membro do board.
-- (O actor_id deve ser o próprio usuário.)
drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log
  for insert
  with check (
    auth.uid() is not null
    and (actor_id is null or actor_id = auth.uid())
    and (
      public.is_admin()
      or exists (
        select 1 from public.boards b
        where b.id = activity_log.board_id and b.owner_id = auth.uid()
      )
      or exists (
        select 1 from public.board_members bm
        where bm.board_id = activity_log.board_id and bm.user_id = auth.uid()
      )
    )
  );

-- Logs são imutáveis: nenhum UPDATE/DELETE via API.
-- (a exclusão em cascata pelo board_id continua válida no servidor)
