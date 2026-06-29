-- ============================================================
-- 0012 — Encerramento automático de sessões de jornada paradas
--
-- Uma sessão de trabalho "pausa" de forma IMPLÍCITA quando o
-- relatório de 30 min não chega dentro do intervalo + tolerância
-- (ver 0003_work_journey.sql). A pausa não é um evento gravado —
-- é derivada dos timestamps. Por isso, uma sessão pode ficar
-- ativa (checked_out_at = null) indefinidamente mesmo sem o dev
-- estar trabalhando (ex.: esqueceu de dar check-out e fechou o
-- navegador). Foi o caso de sessões "pausadas há 2 dias".
--
-- Esta migration encerra automaticamente sessões paradas há mais
-- de 60 min após o início da pausa. Crucial: o check-out é fixado
-- no INSTANTE EM QUE A SESSÃO PAUSOU (o deadline do último ciclo),
-- NÃO em now(). Como as horas válidas são derivadas e já param de
-- contar no deadline, encerrar assim não altera nenhuma hora
-- registrada — apenas libera a sessão para um novo check-in e
-- remove o estado "pendurado".
-- ============================================================

-- Minutos de pausa tolerados antes do encerramento automático.
-- Ajuste aqui se quiser outro limite.
create or replace function public.auto_close_stale_sessions()
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  v_grace_after_pause constant interval := '60 min';
  s record;
  last_event timestamptz;   -- início do último ciclo aberto
  paused_at  timestamptz;   -- instante em que a sessão pausou (deadline)
  closed     integer := 0;
begin
  for s in
    select id, checked_in_at, report_interval_min, report_grace_min
      from work_sessions
     where checked_out_at is null
  loop
    -- Início do último ciclo = max(check-in, último relatório da sessão).
    select greatest(
             s.checked_in_at,
             coalesce(max(submitted_at), s.checked_in_at)
           )
      into last_event
      from work_reports
     where session_id = s.id;

    -- Instante da pausa = fim do intervalo + tolerância sem novo relatório.
    paused_at := last_event
               + (s.report_interval_min || ' min')::interval
               + (s.report_grace_min || ' min')::interval;

    -- Só encerra se já passou o limite de pausa tolerada.
    if now() >= paused_at + v_grace_after_pause then
      update work_sessions
         set checked_out_at = paused_at
       where id = s.id
         and checked_out_at is null;
      closed := closed + 1;
    end if;
  end loop;

  return closed;
end; $$;

revoke all on function public.auto_close_stale_sessions() from public;
-- Executável por admins (para acionar manualmente, se preciso) e pelo cron.
grant execute on function public.auto_close_stale_sessions() to authenticated;

-- ── Agendamento via pg_cron ─────────────────────────────────
-- Roda a cada 15 minutos. Requer a extensão pg_cron (disponível
-- no Supabase). Envolto em bloco defensivo para não quebrar a
-- migration em ambientes sem a extensão.
do $$
begin
  create extension if not exists pg_cron;

  -- Remove agendamento anterior, se existir (idempotência).
  perform cron.unschedule('auto_close_stale_sessions')
    where exists (select 1 from cron.job where jobname = 'auto_close_stale_sessions');

  perform cron.schedule(
    'auto_close_stale_sessions',
    '*/15 * * * *',
    $cron$ select public.auto_close_stale_sessions(); $cron$
  );
exception
  when undefined_file or insufficient_privilege or feature_not_supported then
    raise notice 'pg_cron indisponível; rode auto_close_stale_sessions() manualmente ou via agendador externo.';
end $$;
