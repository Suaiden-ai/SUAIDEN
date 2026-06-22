-- ============================================================
-- Permitir que ADMINISTRADORES leiam tasks/colunas/boards de
-- TODOS os quadros (não só dos que participam).
--
-- Problema: as telas admin (/admin/metrics, /admin/developers/:id)
-- agregam tasks de todos os devs/projetos. Mas as policies de RLS
-- de `tasks`/`columns`/`boards` limitam o SELECT a membros do board.
-- Como o admin não é membro, as queries voltam VAZIAS e as métricas
-- aparecem zeradas.
--
-- Esta migration ADICIONA uma policy de SELECT para admin em cada
-- tabela. Policies de SELECT são combinadas com OR no Postgres, então
-- isso NÃO altera o acesso já existente dos demais usuários — apenas
-- concede leitura adicional ao admin. Reusa is_admin() (migration 0002).
-- ============================================================

-- Garante RLS habilitado (não altera o que já estiver ligado).
alter table public.tasks   enable row level security;
alter table public.columns enable row level security;
alter table public.boards  enable row level security;

-- tasks: admin lê todas
drop policy if exists "admin_read_tasks" on public.tasks;
create policy "admin_read_tasks" on public.tasks
  for select
  using (public.is_admin());

-- columns: admin lê todas (necessário para mapear task → board)
drop policy if exists "admin_read_columns" on public.columns;
create policy "admin_read_columns" on public.columns
  for select
  using (public.is_admin());

-- boards: admin lê todos
drop policy if exists "admin_read_boards" on public.boards;
create policy "admin_read_boards" on public.boards
  for select
  using (public.is_admin());

-- board_members: admin lê todos (usado para listar projetos do dev)
alter table public.board_members enable row level security;
drop policy if exists "admin_read_board_members" on public.board_members;
create policy "admin_read_board_members" on public.board_members
  for select
  using (public.is_admin());
