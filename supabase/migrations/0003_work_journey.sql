-- ============================================================
-- 0003 — Sistema de Jornada de Trabalho (check-in/out + relatórios)
--
-- Fonte da verdade: eventos append-only com timestamp do SERVIDOR.
-- As horas trabalhadas são DERIVADAS desses eventos, nunca
-- armazenadas como contador. A "pausa" (quando o relatório de 30
-- min não é enviado a tempo) é IMPLÍCITA — calculada on-read a
-- partir dos timestamps, não gravada como evento.
--
-- Reusa is_admin() (SECURITY DEFINER) da migration 0002.
-- ============================================================

-- ── 3.1 Configuração de expectativa de jornada por dev ──────
create table if not exists work_schedule (
  user_id      uuid primary key references profiles(id) on delete cascade,
  mode         text not null check (mode in ('fixed', 'weekly_hours')),
  -- modo 'fixed':
  start_time   time,
  end_time     time,
  weekdays     int[],                -- ISO 1=seg ... 7=dom, ex {1,2,3,4,5}
  timezone     text not null default 'America/Sao_Paulo',
  -- modo 'weekly_hours':
  weekly_hours numeric(5,2),
  -- parâmetros do ciclo de relatório:
  report_interval_min int not null default 30,
  report_grace_min    int not null default 5,
  updated_at   timestamptz not null default now(),
  constraint chk_fixed_fields check (
    mode <> 'fixed' or (start_time is not null and end_time is not null and weekdays is not null)
  ),
  constraint chk_weekly_fields check (
    mode <> 'weekly_hours' or weekly_hours is not null
  )
);

-- ── 3.2 Sessões de jornada (uma por check-in → check-out) ───
create table if not exists work_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  checked_in_at  timestamptz not null default now(),
  checked_out_at timestamptz,                          -- null = sessão ativa
  -- snapshot dos parâmetros no momento do check-in (estável/auditável):
  report_interval_min int not null default 30,
  report_grace_min    int not null default 5,
  created_at     timestamptz not null default now()
);

-- No máximo UMA sessão ativa por dev:
create unique index if not exists uniq_active_session
  on work_sessions(user_id) where checked_out_at is null;
create index if not exists idx_ws_user on work_sessions(user_id);
create index if not exists idx_ws_in on work_sessions(checked_in_at);

-- ── 3.3 Relatórios de 30 min (eventos que fecham ciclos) ────
create table if not exists work_reports (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references work_sessions(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  content      text not null check (length(trim(content)) > 0),
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_wr_session on work_reports(session_id, submitted_at);
create index if not exists idx_wr_user on work_reports(user_id);

-- ── 3.4 Triggers: forçar timestamp do servidor (anti-fraude) ─
create or replace function force_server_ts_report()
returns trigger language plpgsql as $$
begin
  new.submitted_at := now();
  new.created_at := now();
  return new;
end; $$;

drop trigger if exists trg_force_ts_report on work_reports;
create trigger trg_force_ts_report before insert on work_reports
  for each row execute function force_server_ts_report();

create or replace function force_server_ts_session()
returns trigger language plpgsql as $$
begin
  new.checked_in_at := now();
  new.created_at := now();
  new.checked_out_at := null;
  return new;
end; $$;

drop trigger if exists trg_force_ts_session on work_sessions;
create trigger trg_force_ts_session before insert on work_sessions
  for each row execute function force_server_ts_session();

-- ── 3.5 RPCs ────────────────────────────────────────────────

-- Relógio do servidor (sync de offset no cliente)
create or replace function server_now()
returns timestamptz language sql stable as $$ select now() $$;

-- Check-out atômico da sessão ativa do próprio usuário
create or replace function check_out()
returns timestamptz language plpgsql security invoker set search_path = public as $$
declare ts timestamptz;
begin
  update work_sessions
     set checked_out_at = now()
   where user_id = auth.uid() and checked_out_at is null
   returning checked_out_at into ts;
  return ts;
end; $$;

-- Segundos válidos de UMA sessão (implementa o algoritmo de derivação).
create or replace function work_session_valid_seconds(p_session_id uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  s record; r record;
  cycle_start timestamptz; deadline timestamptz; tend timestamptz;
  total numeric := 0;
begin
  select * into s from work_sessions where id = p_session_id;
  if not found then return 0; end if;

  tend := coalesce(s.checked_out_at, now());
  cycle_start := s.checked_in_at;

  for r in
    select submitted_at from work_reports
    where session_id = p_session_id order by submitted_at
  loop
    if cycle_start >= tend then exit; end if;
    deadline := cycle_start
              + (s.report_interval_min || ' min')::interval
              + (s.report_grace_min || ' min')::interval;
    if r.submitted_at <= deadline then
      total := total + extract(epoch from (least(r.submitted_at, tend) - cycle_start));
    else
      total := total + extract(epoch from (least(deadline, tend) - cycle_start));
    end if;
    cycle_start := r.submitted_at;
  end loop;

  -- ciclo aberto final (sem mais relatórios)
  if cycle_start < tend then
    deadline := cycle_start
              + (s.report_interval_min || ' min')::interval
              + (s.report_grace_min || ' min')::interval;
    total := total + extract(epoch from (least(deadline, tend) - cycle_start));
  end if;

  return total;
end; $$;

-- Soma de segundos válidos de um dev numa janela [from, to].
create or replace function work_valid_seconds_between(
  p_user uuid, p_from timestamptz, p_to timestamptz
)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare s record; total numeric := 0;
begin
  -- só admin ou o próprio dev podem agregar
  if not (public.is_admin() or auth.uid() = p_user) then
    return 0;
  end if;
  for s in
    select id from work_sessions
    where user_id = p_user
      and checked_in_at < p_to
      and coalesce(checked_out_at, now()) > p_from
  loop
    total := total + work_session_valid_seconds(s.id);
  end loop;
  return total;
end; $$;

revoke all on function server_now() from public;
revoke all on function check_out() from public;
revoke all on function work_session_valid_seconds(uuid) from public;
revoke all on function work_valid_seconds_between(uuid, timestamptz, timestamptz) from public;
grant execute on function server_now() to authenticated;
grant execute on function check_out() to authenticated;
grant execute on function work_session_valid_seconds(uuid) to authenticated;
grant execute on function work_valid_seconds_between(uuid, timestamptz, timestamptz) to authenticated;

-- ── 3.6 RLS ─────────────────────────────────────────────────
alter table work_schedule enable row level security;
alter table work_sessions enable row level security;
alter table work_reports  enable row level security;

-- work_schedule: dev lê o próprio; admin lê/escreve tudo.
drop policy if exists "ws_select_own_or_admin" on work_schedule;
create policy "ws_select_own_or_admin" on work_schedule for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "ws_admin_write" on work_schedule;
create policy "ws_admin_write" on work_schedule for all
  using (public.is_admin()) with check (public.is_admin());

-- work_sessions: dev faz CRUD só do próprio; admin lê tudo.
drop policy if exists "wsess_select" on work_sessions;
create policy "wsess_select" on work_sessions for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "wsess_insert_own" on work_sessions;
create policy "wsess_insert_own" on work_sessions for insert
  with check (user_id = auth.uid());
drop policy if exists "wsess_update_own" on work_sessions;
create policy "wsess_update_own" on work_sessions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- work_reports: dev insere/lê só os próprios; admin lê tudo. Imutável.
drop policy if exists "wrep_select" on work_reports;
create policy "wrep_select" on work_reports for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "wrep_insert_own" on work_reports;
create policy "wrep_insert_own" on work_reports for insert
  with check (user_id = auth.uid());
