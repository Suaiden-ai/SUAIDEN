import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import {
  Loader2,
  Clock,
  CalendarDays,
  Play,
  Pause,
  CheckCircle2,
  ChevronDown,
  FileText,
  TimerReset,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  sessionValidSeconds,
  formatHMS,
  type WorkSession,
  type WorkReport,
} from '../../lib/workJourney';
import { useWorkJourney } from '../../hooks/jobs/useWorkJourney';

interface SessionWithReports extends WorkSession {
  reports: WorkReport[];
  validSeconds: number;
}

interface DayGroup {
  dateKey: string;        // YYYY-MM-DD
  label: string;          // ex: "quinta, 19 de junho"
  totalSeconds: number;
  sessions: SessionWithReports[];
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfWeek = () => {
  const d = startOfToday();
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  return d;
};
const dateKeyOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const timeLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

const MyJourneyDashboard: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  // Sessões "cruas" (com relatórios). O validSeconds é derivado ao vivo a cada tick.
  const [rawSessions, setRawSessions] = useState<{ session: WorkSession; reports: WorkReport[] }[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Status ao vivo da jornada atual (reusa o hook do widget)
  const { status, activeSession } = useWorkJourney(userId);

  // Tick de 1s para recalcular o tempo das sessões em andamento
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
      setAuthLoading(false);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: sess } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false });

      const sessionList = (sess as WorkSession[]) || [];
      const ids = sessionList.map((s) => s.id);

      let reportsBySession = new Map<string, WorkReport[]>();
      if (ids.length) {
        const { data: reps } = await supabase
          .from('work_reports')
          .select('*')
          .in('session_id', ids)
          .order('submitted_at', { ascending: true });
        (reps as WorkReport[] | null)?.forEach((r) => {
          const arr = reportsBySession.get(r.session_id) || [];
          arr.push(r);
          reportsBySession.set(r.session_id, arr);
        });
      }

      const raw = sessionList.map((s) => ({ session: s, reports: reportsBySession.get(s.id) || [] }));
      setRawSessions(raw);
    } catch (err) {
      console.error('Erro ao carregar jornadas:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchData();
    const channel = supabase
      .channel(`my-journey-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions', filter: `user_id=eq.${userId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_reports', filter: `user_id=eq.${userId}` }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  // Deriva validSeconds ao vivo (recalcula a cada segundo via `tick`).
  const sessions = useMemo<SessionWithReports[]>(() => {
    const now = Date.now();
    return rawSessions.map(({ session, reports }) => ({
      ...session,
      reports,
      validSeconds: sessionValidSeconds(session, reports, now),
    }));
  }, [rawSessions, tick]);

  // Agrupa sessões por dia
  const days = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    sessions.forEach((s) => {
      const key = dateKeyOf(s.checked_in_at);
      const group =
        map.get(key) || { dateKey: key, label: dayLabel(s.checked_in_at), totalSeconds: 0, sessions: [] };
      group.sessions.push(s);
      group.totalSeconds += s.validSeconds;
      map.set(key, group);
    });
    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [sessions]);

  // Métricas-resumo
  const summary = useMemo(() => {
    const todayStart = startOfToday().getTime();
    const weekStart = startOfWeek().getTime();
    let today = 0;
    let week = 0;
    let total = 0;
    let reportsCount = 0;
    sessions.forEach((s) => {
      total += s.validSeconds;
      reportsCount += s.reports.length;
      const t = new Date(s.checked_in_at).getTime();
      if (t >= todayStart) today += s.validSeconds;
      if (t >= weekStart) week += s.validSeconds;
    });
    return { today, week, total, reportsCount, sessions: sessions.length };
  }, [sessions]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const liveActive = !!activeSession;
  const statusLabel =
    status.state === 'paused'
      ? 'Pausado'
      : status.state === 'running_pending_report'
      ? 'Relatório pendente'
      : status.state === 'running'
      ? 'Trabalhando'
      : 'Offline';
  const statusCls =
    status.state === 'paused'
      ? 'text-red-400 border-red-500/30 bg-red-500/10'
      : status.state === 'running_pending_report'
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : status.state === 'running'
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : 'text-white/40 border-white/10 bg-white/5';

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-2 border-b border-white/5 pb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Minha Jornada</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe seu tempo de trabalho, jornadas por data e relatórios enviados.
        </p>
      </div>

      {/* Status ao vivo + métricas */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            {liveActive && status.state === 'paused' ? (
              <Pause className="w-4 h-4 text-primary" />
            ) : (
              <Play className="w-4 h-4 text-primary" />
            )}
          </div>
          <div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusCls}`}>
              {statusLabel}
            </span>
            <p className="font-mono text-xl font-black text-white tabular-nums mt-1">
              {liveActive ? formatHMS(status.validSeconds) : '--:--:--'}
            </p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Sessão atual</p>
          </div>
        </div>

        <SummaryCard icon={Clock} label="Horas hoje" value={formatHMS(summary.today)} />
        <SummaryCard icon={CalendarDays} label="Horas na semana" value={formatHMS(summary.week)} />
        <SummaryCard icon={TimerReset} label="Total acumulado" value={formatHMS(summary.total)} />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={CalendarDays} label="Jornadas registradas" value={summary.sessions} />
        <SummaryCard icon={FileText} label="Relatórios enviados" value={summary.reportsCount} />
      </section>

      {/* Histórico por data */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(131,52,255,0.3)]">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-white font-extrabold text-sm tracking-wider uppercase">Histórico por data</h2>
        </div>

        {days.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#1d2125] py-12 text-center text-white/40 text-sm font-medium">
            Nenhuma jornada registrada ainda. Faça check-in para começar.
          </div>
        ) : (
          days.map((day) => {
            const isOpen = expandedDay === day.dateKey;
            return (
              <div key={day.dateKey} className="rounded-2xl border border-white/5 bg-[#1d2125] overflow-hidden">
                <button
                  onClick={() => setExpandedDay(isOpen ? null : day.dateKey)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold capitalize truncate">{day.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.sessions.length} jornada{day.sessions.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-black text-white tabular-nums shrink-0">
                    {formatHMS(day.totalSeconds)}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform shrink-0 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-1 border-t border-white/5 space-y-4">
                        {day.sessions.map((s) => (
                          <div key={s.id} className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-emerald-400 font-bold">{timeLabel(s.checked_in_at)}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className={`font-bold ${s.checked_out_at ? 'text-white' : 'text-amber-400'}`}>
                                  {s.checked_out_at ? timeLabel(s.checked_out_at) : 'em andamento'}
                                </span>
                              </div>
                              <span className="font-mono text-sm font-black text-white tabular-nums">
                                {formatHMS(s.validSeconds)}
                              </span>
                            </div>

                            {s.reports.length > 0 ? (
                              <div className="space-y-2">
                                {s.reports.map((r) => (
                                  <div key={r.id} className="flex gap-2.5 text-sm">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                      <span className="text-[10px] text-muted-foreground mr-2">{timeLabel(r.submitted_at)}</span>
                                      <span className="text-white/90 break-words">{r.content}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-white/30">Nenhum relatório nesta jornada.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};

const SummaryCard: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode }> = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-3">
    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div>
      <p className="text-xl font-black text-white">{value}</p>
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  </div>
);

export default MyJourneyDashboard;
