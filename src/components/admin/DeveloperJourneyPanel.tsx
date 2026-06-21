import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Progress } from '../jobs/ui/progress';
import {
  deriveStatus,
  formatHMS,
  type WorkSession,
  type WorkReport,
  type WorkSchedule,
} from '../../lib/workJourney';
import { Loader2, Clock, Save, CalendarClock, Pause, Play } from 'lucide-react';

interface DeveloperJourneyPanelProps {
  devId: string;
}

const WEEKDAYS = [
  { v: 1, label: 'Seg' },
  { v: 2, label: 'Ter' },
  { v: 3, label: 'Qua' },
  { v: 4, label: 'Qui' },
  { v: 5, label: 'Sex' },
  { v: 6, label: 'Sáb' },
  { v: 7, label: 'Dom' },
];

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const startOfWeek = () => {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const DeveloperJourneyPanel: React.FC<DeveloperJourneyPanelProps> = ({ devId }) => {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [secondsToday, setSecondsToday] = useState(0);
  const [secondsWeek, setSecondsWeek] = useState(0);
  const [tick, setTick] = useState(0);

  // Form de configuração
  const [mode, setMode] = useState<'fixed' | 'weekly_hours'>('weekly_hours');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [weeklyHours, setWeeklyHours] = useState('40');
  const [saving, setSaving] = useState(false);

  const loadConfigIntoForm = useCallback((s: WorkSchedule) => {
    setMode(s.mode);
    if (s.start_time) setStartTime(s.start_time.slice(0, 5));
    if (s.end_time) setEndTime(s.end_time.slice(0, 5));
    if (s.weekdays) setWeekdays(s.weekdays);
    if (s.weekly_hours != null) setWeeklyHours(String(s.weekly_hours));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [schedRes, sessRes, todayRes, weekRes] = await Promise.all([
        supabase.from('work_schedule').select('*').eq('user_id', devId).maybeSingle(),
        supabase
          .from('work_sessions')
          .select('*')
          .eq('user_id', devId)
          .is('checked_out_at', null)
          .order('checked_in_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc('work_valid_seconds_between', { p_user: devId, p_from: startOfDay(), p_to: new Date().toISOString() }),
        supabase.rpc('work_valid_seconds_between', { p_user: devId, p_from: startOfWeek(), p_to: new Date().toISOString() }),
      ]);

      const sched = (schedRes.data as WorkSchedule | null) ?? null;
      setSchedule(sched);
      if (sched) loadConfigIntoForm(sched);

      const session = (sessRes.data as WorkSession | null) ?? null;
      setActiveSession(session);
      setSecondsToday(Number(todayRes.data) || 0);
      setSecondsWeek(Number(weekRes.data) || 0);

      if (session) {
        const { data: reps } = await supabase
          .from('work_reports')
          .select('*')
          .eq('session_id', session.id)
          .order('submitted_at', { ascending: true });
        setReports((reps as WorkReport[]) || []);
      } else {
        // últimos relatórios do dev (mesmo sem sessão ativa)
        const { data: reps } = await supabase
          .from('work_reports')
          .select('*')
          .eq('user_id', devId)
          .order('submitted_at', { ascending: false })
          .limit(10);
        setReports((reps as WorkReport[]) || []);
      }
    } catch (err) {
      console.error('Erro ao carregar jornada do dev:', err);
    } finally {
      setLoading(false);
    }
  }, [devId, loadConfigIntoForm]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`admin-journey-${devId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions', filter: `user_id=eq.${devId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_reports', filter: `user_id=eq.${devId}` }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [devId, fetchData]);

  // Tick de 1s para o status ao vivo
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const status = useMemo(
    () => deriveStatus(activeSession, reports, Date.now()),
    [activeSession, reports, tick] // tick força recálculo a cada segundo
  );

  const toggleWeekday = (v: number) =>
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort()));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: devId,
        mode,
        updated_at: new Date().toISOString(),
        timezone: schedule?.timezone || 'America/Sao_Paulo',
      };
      if (mode === 'fixed') {
        payload.start_time = startTime;
        payload.end_time = endTime;
        payload.weekdays = weekdays;
        payload.weekly_hours = null;
      } else {
        payload.weekly_hours = Number(weeklyHours) || 0;
        payload.start_time = null;
        payload.end_time = null;
        payload.weekdays = null;
      }
      const { error } = await supabase.from('work_schedule').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Erro ao salvar jornada:', err);
      alert('Não foi possível salvar a configuração de jornada.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  // Expectativa semanal em segundos (para a barra de progresso da semana)
  const weeklyTargetHours =
    schedule?.mode === 'weekly_hours' && schedule.weekly_hours
      ? schedule.weekly_hours
      : schedule?.mode === 'fixed' && schedule.start_time && schedule.end_time && schedule.weekdays
      ? hoursBetween(schedule.start_time, schedule.end_time) * schedule.weekdays.length
      : null;
  const weekTargetSeconds = weeklyTargetHours ? weeklyTargetHours * 3600 : null;
  const weekPct = weekTargetSeconds ? Math.min(100, Math.round((secondsWeek / weekTargetSeconds) * 100)) : null;

  const statusConfig =
    status.state === 'offline'
      ? { label: 'Offline', cls: 'text-white/40 border-white/10 bg-white/5', Icon: Clock }
      : status.state === 'paused'
      ? { label: 'Pausado', cls: 'text-red-400 border-red-500/30 bg-red-500/10', Icon: Pause }
      : status.state === 'running_pending_report'
      ? { label: 'Relatório pendente', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10', Icon: Clock }
      : { label: 'Trabalhando', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', Icon: Play };

  return (
    <div className="space-y-5 pt-3">
      {/* Status + horas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">Status atual</p>
          <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-bold ${statusConfig.cls}`}>
            <statusConfig.Icon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </div>
          {status.state !== 'offline' && (
            <p className="font-mono text-lg font-black text-white tabular-nums mt-2">{formatHMS(status.validSeconds)}</p>
          )}
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Horas hoje</p>
          <p className="text-2xl font-black text-white">{formatHMS(secondsToday)}</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Horas na semana</p>
          <p className="text-2xl font-black text-white">{formatHMS(secondsWeek)}</p>
          {weekPct !== null && (
            <div className="mt-2 space-y-1">
              <Progress value={weekPct} className="h-1.5 bg-white/10" />
              <p className="text-[10px] text-muted-foreground">
                {weekPct}% de {weeklyTargetHours}h
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Configuração de jornada */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configuração de jornada</h4>
        </div>

        <div className="flex items-center gap-2">
          {(['weekly_hours', 'fixed'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                mode === m ? 'bg-primary/15 border-primary/40 text-primary' : 'border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {m === 'weekly_hours' ? 'Horas/semana' : 'Horário fixo'}
            </button>
          ))}
        </div>

        {mode === 'weekly_hours' ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.5"
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              className="w-24 bg-black/30 border border-white/10 focus:border-primary/50 rounded-lg px-3 py-2 text-sm text-white outline-none"
            />
            <span className="text-xs text-muted-foreground">horas por semana</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground">Início</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-black/30 border border-white/10 focus:border-primary/50 rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
              <label className="text-xs text-muted-foreground">Fim</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-black/30 border border-white/10 focus:border-primary/50 rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.v}
                  onClick={() => toggleWeekday(d.v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                    weekdays.includes(d.v) ? 'bg-primary/15 border-primary/40 text-primary' : 'border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Salvar configuração
        </button>
      </div>

      {/* Relatórios recentes */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Relatórios recentes</h4>
        {reports.length === 0 ? (
          <p className="text-xs text-white/40">Nenhum relatório enviado ainda.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {[...reports]
              .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
              .map((r) => (
                <div key={r.id} className="rounded-lg bg-black/20 border border-white/5 p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">
                    {new Date(r.submitted_at).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{r.content}</p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.slice(0, 5).split(':').map(Number);
  const [eh, em] = end.slice(0, 5).split(':').map(Number);
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

export default DeveloperJourneyPanel;
