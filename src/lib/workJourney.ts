// ============================================================
// Algoritmo puro de derivação da jornada de trabalho.
//
// O cronômetro NUNCA é um número armazenado: é uma função pura
// derive(eventos, now). A "pausa" é implícita — calculada a
// partir dos timestamps quando o relatório de 30 min atrasa
// além da tolerância. Mesma lógica do work_session_valid_seconds
// em supabase/migrations/0003_work_journey.sql.
//
// Todos os tempos aqui são epoch em MILISSEGUNDOS.
// ============================================================

export interface WorkSession {
  id: string;
  user_id: string;
  checked_in_at: string;            // ISO
  checked_out_at: string | null;    // ISO ou null (ativa)
  report_interval_min: number;
  report_grace_min: number;
}

export interface WorkReport {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  submitted_at: string;             // ISO
}

export interface WorkSchedule {
  user_id: string;
  mode: 'fixed' | 'weekly_hours';
  start_time: string | null;
  end_time: string | null;
  weekdays: number[] | null;
  timezone: string;
  weekly_hours: number | null;
  report_interval_min: number;
  report_grace_min: number;
}

export type JourneyState =
  | 'offline'                  // sem sessão ativa
  | 'running'                  // dentro do ciclo, relatório ainda não vencido
  | 'running_pending_report'   // venceu o intervalo, dentro da tolerância (modal deve estar aberto)
  | 'paused';                  // estourou a tolerância sem relatório — tempo extra não conta

export interface JourneyStatus {
  state: JourneyState;
  /** Segundos válidos derivados até `now`. */
  validSeconds: number;
  /** Quando o próximo relatório vence (ms epoch) — abre o modal. null se offline. */
  reportDueAt: number | null;
  /** Limite da tolerância (ms epoch). Após isso, pausa. null se offline. */
  deadlineAt: number | null;
  /** Instante em que pausou (ms epoch), quando state === 'paused'. */
  pausedSince: number | null;
}

const MIN = 60 * 1000;

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Segundos válidos de UMA sessão até `now` (ms epoch).
 * Espelha work_session_valid_seconds() do SQL.
 */
export function sessionValidSeconds(
  session: WorkSession,
  reports: WorkReport[],
  now: number
): number {
  const I = session.report_interval_min * MIN;
  const G = session.report_grace_min * MIN;
  const tEnd = session.checked_out_at ? ms(session.checked_out_at) : now;

  const sorted = reports
    .filter((r) => r.session_id === session.id)
    .map((r) => ms(r.submitted_at))
    .sort((a, b) => a - b);

  let total = 0;
  let cycleStart = ms(session.checked_in_at);
  let i = 0;

  while (cycleStart < tEnd) {
    const deadline = cycleStart + I + G;
    const r = i < sorted.length ? sorted[i] : null;

    if (r !== null && r <= deadline) {
      // relatório em dia
      total += Math.min(r, tEnd) - cycleStart;
      cycleStart = r;
      i += 1;
    } else if (r !== null) {
      // relatório atrasado → pausou em deadline; buraco descartado
      total += Math.min(deadline, tEnd) - cycleStart;
      cycleStart = r;
      i += 1;
    } else {
      // ciclo aberto, sem mais relatórios
      total += Math.min(deadline, tEnd) - cycleStart;
      break;
    }
  }

  return Math.max(0, Math.floor(total / 1000));
}

/**
 * Status ao vivo de uma sessão ativa (ou offline).
 * `session` deve ser a sessão ATIVA (checked_out_at === null) ou null.
 */
export function deriveStatus(
  session: WorkSession | null,
  reports: WorkReport[],
  now: number
): JourneyStatus {
  if (!session || session.checked_out_at) {
    return { state: 'offline', validSeconds: 0, reportDueAt: null, deadlineAt: null, pausedSince: null };
  }

  const I = session.report_interval_min * MIN;
  const G = session.report_grace_min * MIN;

  const sessionReports = reports
    .filter((r) => r.session_id === session.id)
    .map((r) => ms(r.submitted_at))
    .sort((a, b) => a - b);

  const lastReport = sessionReports.length ? sessionReports[sessionReports.length - 1] : null;
  const cycleStart = Math.max(ms(session.checked_in_at), lastReport ?? 0);

  const reportDueAt = cycleStart + I;
  const deadlineAt = cycleStart + I + G;

  const validSeconds = sessionValidSeconds(session, reports, now);

  let state: JourneyState;
  let pausedSince: number | null = null;
  if (now < reportDueAt) state = 'running';
  else if (now <= deadlineAt) state = 'running_pending_report';
  else {
    state = 'paused';
    pausedSince = deadlineAt;
  }

  return { state, validSeconds, reportDueAt, deadlineAt, pausedSince };
}

/** Formata segundos como HH:MM:SS. */
export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
