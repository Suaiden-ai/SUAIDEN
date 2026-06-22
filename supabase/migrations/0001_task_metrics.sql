-- ============================================================
-- Sistema de Métricas de Tasks e Desempenho
-- Adiciona timestamps às tasks, trigger de conclusão e
-- tabela de histórico de atividade (task_activity).
-- ============================================================

-- 1.1 Timestamps na tabela tasks
alter table tasks
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz;

-- 1.2 Trigger para manter updated_at e completed_at
create or replace function set_task_timestamps()
returns trigger as $$
begin
  new.updated_at := now();
  if new.is_done = true and (old.is_done is distinct from true) then
    new.completed_at := now();
  elsif new.is_done = false then
    new.completed_at := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_task_timestamps on tasks;
create trigger trg_task_timestamps
  before update on tasks
  for each row execute function set_task_timestamps();

-- Backfill: tasks já concluídas ganham completed_at = updated_at (aproximado)
update tasks
  set completed_at = coalesce(completed_at, updated_at)
  where is_done = true and completed_at is null;

-- 1.3 Tabela de histórico de atividade
create table if not exists task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  board_id uuid references boards(id) on delete cascade,
  user_id uuid references profiles(id),
  action text not null,              -- 'created' | 'completed' | 'reopened' | 'moved' | 'assigned'
  from_column_id uuid,
  to_column_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_activity_board on task_activity(board_id);
create index if not exists idx_task_activity_created on task_activity(created_at);
create index if not exists idx_task_activity_task on task_activity(task_id);

-- 1.4 RLS para task_activity
alter table task_activity enable row level security;

-- Helper: usuário tem acesso ao board (dono ou membro) ou é admin
-- SELECT: membros do board (dono/membro) ou admin podem ler a atividade.
drop policy if exists "task_activity_select" on task_activity;
create policy "task_activity_select" on task_activity
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    or exists (
      select 1 from boards b
      where b.id = task_activity.board_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from board_members bm
      where bm.board_id = task_activity.board_id and bm.user_id = auth.uid()
    )
  );

-- INSERT: admin e developer podem registrar atividade.
drop policy if exists "task_activity_insert" on task_activity;
create policy "task_activity_insert" on task_activity
  for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('admin', 'developer')
    )
  );
