import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { formatHMS, type WorkReport, type WorkSession } from '../../lib/workJourney';
import { Loader2, ChevronDown, CalendarDays, Clock, FileText } from 'lucide-react';

interface DeveloperDailyHistoryProps {
  devId: string;
}

type PeriodFilter = 'all' | '30d' | '7d';

interface DayEntry {
  /** Chave do dia (YYYY-MM-DD, fuso local). */
  dateKey: string;
  /** Início do dia em ISO (00:00 local). */
  fromIso: string;
  /** Fim do dia em ISO (23:59:59.999 local). */
  toIso: string;
  reports: WorkReport[];
  /** Segundos válidos trabalhados no dia (preenchido após o cálculo). */
  validSeconds: number | null;
}

// Chave de dia no fuso local (YYYY-MM-DD).
const dayKey = (iso: string) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dayBounds = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const from = new Date(y, m - 1, d, 0, 0, 0, 0);
  const to = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
};

const formatDayLabel = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const label = date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  // Capitaliza o dia da semana ("seg." → "Seg.")
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatHoursShort = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const periodCutoff = (period: PeriodFilter): number | null => {
  if (period === 'all') return null;
  const days = period === '30d' ? 30 : 7;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
};

const DeveloperDailyHistory: React.FC<DeveloperDailyHistoryProps> = ({ devId }) => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [hoursByDay, setHoursByDay] = useState<Map<string, number>>(new Map());
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchBase = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, sessionsRes] = await Promise.all([
        supabase
          .from('work_reports')
          .select('id, session_id, user_id, content, submitted_at')
          .eq('user_id', devId)
          .order('submitted_at', { ascending: false }),
        supabase
          .from('work_sessions')
          .select('id, user_id, checked_in_at, checked_out_at, report_interval_min, report_grace_min')
          .eq('user_id', devId)
          .order('checked_in_at', { ascending: false }),
      ]);

      if (reportsRes.error) console.error('DailyHistory — reports:', reportsRes.error);
      if (sessionsRes.error) console.error('DailyHistory — sessions:', sessionsRes.error);

      setReports((reportsRes.data as WorkReport[]) || []);
      setSessions((sessionsRes.data as WorkSession[]) || []);
    } catch (err) {
      console.error('Erro ao carregar histórico diário:', err);
    } finally {
      setLoading(false);
    }
  }, [devId]);

  useEffect(() => {
    fetchBase();
  }, [fetchBase]);

  // Dias com atividade = união dos dias com relatório e dos dias com check-in.
  const allDayKeys = useMemo(() => {
    const keys = new Set<string>();
    reports.forEach((r) => keys.add(dayKey(r.submitted_at)));
    sessions.forEach((s) => keys.add(dayKey(s.checked_in_at)));
    return Array.from(keys).sort((a, b) => (a < b ? 1 : -1)); // mais recente primeiro
  }, [reports, sessions]);

  // Calcula as horas válidas por dia (uma RPC por dia com atividade).
  // Roda só quando o conjunto de dias muda.
  useEffect(() => {
    if (allDayKeys.length === 0) {
      setHoursByDay(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        allDayKeys.map(async (key) => {
          const { fromIso, toIso } = dayBounds(key);
          const { data, error } = await supabase.rpc('work_valid_seconds_between', {
            p_user: devId,
            p_from: fromIso,
            p_to: toIso,
          });
          if (error) {
            console.error('DailyHistory — seconds', key, error);
            return [key, 0] as const;
          }
          return [key, Number(data) || 0] as const;
        })
      );
      if (!cancelled) setHoursByDay(new Map(results));
    })();
    return () => {
      cancelled = true;
    };
  }, [allDayKeys, devId]);

  // Monta as entradas de dia já filtradas pelo período e com relatórios agrupados.
  const days = useMemo<DayEntry[]>(() => {
    const cutoff = periodCutoff(period);
    const reportsByDay = new Map<string, WorkReport[]>();
    reports.forEach((r) => {
      const key = dayKey(r.submitted_at);
      const arr = reportsByDay.get(key) || [];
      arr.push(r);
      reportsByDay.set(key, arr);
    });

    return allDayKeys
      .filter((key) => {
        if (cutoff === null) return true;
        const { fromIso } = dayBounds(key);
        return new Date(fromIso).getTime() >= cutoff;
      })
      .map((key) => {
        const { fromIso, toIso } = dayBounds(key);
        const dayReports = (reportsByDay.get(key) || []).sort(
          (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
        );
        return {
          dateKey: key,
          fromIso,
          toIso,
          reports: dayReports,
          validSeconds: hoursByDay.has(key) ? hoursByDay.get(key)! : null,
        };
      });
  }, [allDayKeys, reports, hoursByDay, period]);

  const totalSeconds = useMemo(
    () => days.reduce((sum, d) => sum + (d.validSeconds ?? 0), 0),
    [days]
  );

  const toggleDay = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  const periods: { v: PeriodFilter; label: string }[] = [
    { v: 'all', label: 'Tudo' },
    { v: '30d', label: '30 dias' },
    { v: '7d', label: '7 dias' },
  ];

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Dias trabalhados</h4>
        </div>
        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/10">
          {periods.map((p) => (
            <button
              key={p.v}
              onClick={() => setPeriod(p.v)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                period === p.v ? 'bg-primary text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo do período */}
      {days.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="text-white font-bold">{days.length}</span> dia(s)
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-white font-bold">{formatHMS(totalSeconds)}</span> no total
          </span>
        </div>
      )}

      {days.length === 0 ? (
        <p className="text-xs text-white/40 py-4 text-center">
          Nenhum dia de trabalho registrado neste período.
        </p>
      ) : (
        <div className="space-y-2">
          {days.map((day) => {
            const isOpen = expanded.has(day.dateKey);
            return (
              <div key={day.dateKey} className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
                <button
                  onClick={() => toggleDay(day.dateKey)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <ChevronDown
                    className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{formatDayLabel(day.dateKey)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {day.reports.length} relatório(s)
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {day.validSeconds === null ? '…' : formatHoursShort(day.validSeconds)}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-white/5 px-3 py-2 space-y-2">
                    {day.reports.length === 0 ? (
                      <p className="text-[11px] text-white/40 py-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Houve check-in, mas nenhum relatório foi enviado neste dia.
                      </p>
                    ) : (
                      day.reports.map((r) => (
                        <div key={r.id} className="flex gap-3 py-1.5">
                          <span className="text-[11px] font-mono text-primary/80 shrink-0 pt-0.5 tabular-nums">
                            {new Date(r.submitted_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <p className="text-sm text-white/90 whitespace-pre-wrap break-words flex-1 min-w-0">
                            {r.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeveloperDailyHistory;
