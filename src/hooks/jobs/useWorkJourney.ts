import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../services/supabase';
import {
  deriveStatus,
  type WorkSession,
  type WorkReport,
  type WorkSchedule,
  type JourneyStatus,
} from '../../lib/workJourney';

interface UseWorkJourneyResult {
  loading: boolean;
  status: JourneyStatus;
  schedule: WorkSchedule | null;
  activeSession: WorkSession | null;
  /** Sessão ativa existe e o relatório está vencido/atrasado. */
  reportRequired: boolean;
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
  submitReport: (content: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const OFFLINE_STATUS: JourneyStatus = {
  state: 'offline',
  validSeconds: 0,
  reportDueAt: null,
  deadlineAt: null,
  pausedSince: null,
};

/**
 * Hook da jornada de trabalho do desenvolvedor logado.
 * O tempo é SEMPRE derivado dos eventos via serverNow() — o
 * setInterval só força re-render, nunca acumula tempo.
 */
export function useWorkJourney(userId: string | null): UseWorkJourneyResult {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WorkSession | null>(null);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);

  // Offset entre relógio do servidor e do cliente (ms).
  const clockOffsetRef = useRef(0);
  // Tick para forçar recálculo do cronômetro a cada segundo.
  const [tick, setTick] = useState(0);

  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);

  const syncClock = useCallback(async () => {
    try {
      const before = Date.now();
      const { data, error } = await supabase.rpc('server_now');
      if (error || !data) return;
      const after = Date.now();
      const rtt = (after - before) / 2;
      clockOffsetRef.current = new Date(data as string).getTime() - (before + rtt);
    } catch {
      /* mantém offset anterior */
    }
  }, []);

  const fetchState = useCallback(async () => {
    if (!userId) {
      setSession(null);
      setReports([]);
      setSchedule(null);
      setLoading(false);
      return;
    }
    try {
      const [sessRes, schedRes] = await Promise.all([
        supabase
          .from('work_sessions')
          .select('*')
          .eq('user_id', userId)
          .is('checked_out_at', null)
          .order('checked_in_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('work_schedule').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      const activeSession = (sessRes.data as WorkSession | null) ?? null;
      setSession(activeSession);
      setSchedule((schedRes.data as WorkSchedule | null) ?? null);

      if (activeSession) {
        const { data: reps } = await supabase
          .from('work_reports')
          .select('*')
          .eq('session_id', activeSession.id)
          .order('submitted_at', { ascending: true });
        setReports((reps as WorkReport[]) || []);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error('Erro ao carregar jornada:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    await Promise.all([syncClock(), fetchState()]);
  }, [syncClock, fetchState]);

  // Carga inicial + sync de relógio
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tick de 1s só para re-render (não acumula tempo)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Reidratação ao voltar o foco / aba visível
  useEffect(() => {
    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // Realtime nas tabelas da jornada do próprio usuário
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`work-journey-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions', filter: `user_id=eq.${userId}` }, () => fetchState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_reports', filter: `user_id=eq.${userId}` }, () => fetchState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_schedule', filter: `user_id=eq.${userId}` }, () => fetchState())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchState]);

  const status = useMemo(
    () => deriveStatus(session, reports, serverNow()),
    // `tick` muda a cada segundo, forçando o recálculo do cronômetro em tempo real
    [session, reports, serverNow, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const checkIn = useCallback(async () => {
    if (!userId) return;
    const interval = schedule?.report_interval_min ?? 30;
    const grace = schedule?.report_grace_min ?? 5;
    const { error } = await supabase.from('work_sessions').insert({
      user_id: userId,
      report_interval_min: interval,
      report_grace_min: grace,
    });
    if (error) {
      console.error('Erro ao fazer check-in:', error);
      throw error;
    }
    await fetchState();
  }, [userId, schedule, fetchState]);

  const checkOut = useCallback(async () => {
    const { error } = await supabase.rpc('check_out');
    if (error) {
      console.error('Erro ao fazer check-out:', error);
      throw error;
    }
    await fetchState();
  }, [fetchState]);

  const submitReport = useCallback(
    async (content: string) => {
      if (!userId || !session) return;
      const trimmed = content.trim();
      if (!trimmed) return;
      const { error } = await supabase.from('work_reports').insert({
        session_id: session.id,
        user_id: userId,
        content: trimmed,
      });
      if (error) {
        console.error('Erro ao enviar relatório:', error);
        throw error;
      }
      await fetchState();
    },
    [userId, session, fetchState]
  );

  return {
    loading,
    status: session ? status : OFFLINE_STATUS,
    schedule,
    activeSession: session,
    reportRequired:
      !!session && (status.state === 'running_pending_report' || status.state === 'paused'),
    checkIn,
    checkOut,
    submitReport,
    refresh,
  };
}
