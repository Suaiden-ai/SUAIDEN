import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  Loader2,
  Users,
  LayoutGrid,
  ListChecks,
  AlertTriangle,
  Play,
  Pause,
  Clock,
  CircleDot,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Progress } from '../../components/jobs/ui/progress';
import {
  deriveStatus,
  formatHMS,
  type WorkSession,
  type WorkReport,
  type JourneyState,
} from '../../lib/workJourney';

// ── Tipos ──
interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
}
interface TaskRow {
  id: string;
  column_id: string;
  is_done: boolean;
  due_date: string | null;
  assignees: { user_id: string; full_name: string }[];
}
interface Board {
  id: string;
  title: string;
  bg_type: 'gradient' | 'image' | null;
  background: string | null;
  cover_image: string | null;
}

interface LiveDev {
  dev: Profile;
  session: WorkSession;
  reports: WorkReport[];
  state: JourneyState;
  validSeconds: number;
  lastReport: WorkReport | null;
}

const isOverdue = (t: TaskRow) => {
  if (t.is_done || !t.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(t.due_date.split('T')[0] + 'T00:00:00');
  return d < today;
};

const STATE_STYLES: Record<JourneyState, { label: string; cls: string; Icon: React.ElementType }> = {
  offline: { label: 'Offline', cls: 'text-white/40 border-white/10 bg-white/5', Icon: Clock },
  running: { label: 'Trabalhando', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', Icon: Play },
  running_pending_report: { label: 'Relatório pendente', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10', Icon: Clock },
  paused: { label: 'Pausado', cls: 'text-red-400 border-red-500/30 bg-red-500/10', Icon: Pause },
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const [developers, setDevelopers] = useState<Profile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [colToBoard, setColToBoard] = useState<Map<string, string>>(new Map());
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [activeSessions, setActiveSessions] = useState<WorkSession[]>([]);
  const [reportsBySession, setReportsBySession] = useState<Map<string, WorkReport[]>>(new Map());

  const fetchData = useCallback(async () => {
    try {
      // Rede de segurança caso o pg_cron não esteja ativo: encerra
      // sessões paradas há mais de 60 min antes de ler o estado, para
      // que sessões "penduradas" não apareçam como ativas. Falha aqui
      // não bloqueia o carregamento do painel.
      await supabase.rpc('auto_close_stale_sessions').catch(() => {});

      const [profilesRes, boardsRes, colsRes, tasksRes, sessRes] = await Promise.all([
        // `avatar_url` pode ainda não existir (migration 0005 não aplicada).
        // Tenta com a coluna; se falhar, refaz sem ela para não zerar a lista de devs.
        supabase
          .from('profiles')
          .select('id, full_name, email, role, avatar_url')
          .then((res) =>
            res.error
              ? supabase.from('profiles').select('id, full_name, email, role')
              : res
          ),
        supabase.from('boards').select('id, title, bg_type, background, cover_image'),
        supabase.from('columns').select('id, board_id'),
        supabase.from('tasks').select('id, column_id, is_done, due_date, assignees'),
        supabase
          .from('work_sessions')
          .select('*')
          .is('checked_out_at', null)
          .order('checked_in_at', { ascending: false }),
      ]);

      if (profilesRes.error) console.error('Dashboard — profiles:', profilesRes.error);
      if (boardsRes.error) console.error('Dashboard — boards:', boardsRes.error);
      if (colsRes.error) console.error('Dashboard — columns:', colsRes.error);
      if (tasksRes.error) console.error('Dashboard — tasks:', tasksRes.error);
      if (sessRes.error) console.error('Dashboard — sessions:', sessRes.error);

      const profiles = ((profilesRes.data as Partial<Profile>[]) || []).map((p) => ({
        ...p,
        avatar_url: p.avatar_url ?? null,
      })) as Profile[];
      setAllProfiles(profiles);
      setDevelopers(profiles.filter((p) => p.role === 'developer'));
      setBoards((boardsRes.data as Board[]) || []);

      const map = new Map<string, string>();
      ((colsRes.data as { id: string; board_id: string }[]) || []).forEach((c) => map.set(c.id, c.board_id));
      setColToBoard(map);

      setTasks(
        ((tasksRes.data as TaskRow[]) || []).map((t) => ({
          ...t,
          is_done: !!t.is_done,
          assignees: Array.isArray(t.assignees) ? t.assignees : [],
        }))
      );

      const sessions = (sessRes.data as WorkSession[]) || [];
      setActiveSessions(sessions);

      // Relatórios das sessões ativas (para mostrar a atividade atual).
      const sessionIds = sessions.map((s) => s.id);
      const repMap = new Map<string, WorkReport[]>();
      if (sessionIds.length) {
        const { data: reps } = await supabase
          .from('work_reports')
          .select('*')
          .in('session_id', sessionIds)
          .order('submitted_at', { ascending: true });
        (reps as WorkReport[] | null)?.forEach((r) => {
          const arr = repMap.get(r.session_id) || [];
          arr.push(r);
          repMap.set(r.session_id, arr);
        });
      }
      setReportsBySession(repMap);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_reports' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Tick de 1s: recalcula timers e status ao vivo.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── Devs trabalhando agora (derivado ao vivo) ──
  const liveDevs = useMemo<LiveDev[]>(() => {
    // Resolve por TODOS os perfis: qualquer pessoa com jornada ativa
    // (dev ou admin testando) deve aparecer no painel ao vivo.
    const byId = new Map(allProfiles.map((d) => [d.id, d]));
    const now = Date.now();
    return activeSessions
      .map((session) => {
        const dev = byId.get(session.user_id);
        if (!dev) return null;
        const reports = reportsBySession.get(session.id) || [];
        const status = deriveStatus(session, reports, now);
        const lastReport = reports.length ? reports[reports.length - 1] : null;
        return {
          dev,
          session,
          reports,
          state: status.state,
          validSeconds: status.validSeconds,
          lastReport,
        } as LiveDev;
      })
      .filter((x): x is LiveDev => x !== null)
      .sort((a, b) => {
        // Trabalhando primeiro, depois pendente, depois pausado.
        const order: Record<JourneyState, number> = { running: 0, running_pending_report: 1, paused: 2, offline: 3 };
        return order[a.state] - order[b.state];
      });
    // tick força o recálculo ao vivo a cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProfiles, activeSessions, reportsBySession, tick]);

  // ── Resumo geral ──
  const summary = useMemo(() => {
    const open = tasks.filter((t) => !t.is_done).length;
    const overdue = tasks.filter(isOverdue).length;
    const onlineNow = liveDevs.filter((d) => d.state !== 'paused').length;
    return {
      onlineNow,
      paused: liveDevs.filter((d) => d.state === 'paused').length,
      totalDevs: developers.length,
      boards: boards.length,
      open,
      overdue,
    };
  }, [tasks, liveDevs, developers, boards]);

  // ── Resumo por projeto ──
  const projectSummary = useMemo(() => {
    return boards
      .map((board) => {
        const boardTasks = tasks.filter((t) => colToBoard.get(t.column_id) === board.id);
        const done = boardTasks.filter((t) => t.is_done).length;
        const overdue = boardTasks.filter(isOverdue).length;
        const devIds = new Set<string>();
        boardTasks.forEach((t) => t.assignees.forEach((a) => devIds.add(a.user_id)));
        // Devs deste projeto que estão online agora.
        const onlineHere = liveDevs.filter((ld) => devIds.has(ld.dev.id)).length;
        return {
          id: board.id,
          title: board.title,
          bg_type: board.bg_type,
          background: board.background,
          cover_image: board.cover_image,
          total: boardTasks.length,
          done,
          open: boardTasks.length - done,
          overdue,
          devs: devIds.size,
          onlineHere,
          progress: boardTasks.length ? Math.round((done / boardTasks.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.onlineHere - a.onlineHere || b.total - a.total);
  }, [boards, tasks, colToBoard, liveDevs]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Ao vivo</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground text-sm">
            Resumo em tempo real dos projetos e do que a equipe está trabalhando agora.
          </p>
        </div>
      </div>

      {/* Cards de resumo */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Online agora"
          value={summary.onlineNow}
          hint={`${summary.totalDevs} desenvolvedor${summary.totalDevs === 1 ? '' : 'es'}${summary.paused ? ` · ${summary.paused} pausado(s)` : ''}`}
          accent="emerald"
        />
        <StatCard icon={LayoutGrid} label="Projetos" value={summary.boards} hint="quadros ativos" accent="primary" />
        <StatCard icon={ListChecks} label="Tarefas abertas" value={summary.open} hint="em andamento" accent="primary" />
        <StatCard
          icon={AlertTriangle}
          label="Atrasadas"
          value={summary.overdue}
          hint={summary.overdue ? 'requer atenção' : 'tudo em dia'}
          accent={summary.overdue ? 'red' : 'primary'}
        />
      </section>

      {/* Trabalhando agora */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(131,52,255,0.3)]">
            <CircleDot className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-white font-extrabold text-sm tracking-wider uppercase">Trabalhando agora</h2>
          <span className="text-xs text-muted-foreground font-medium">{liveDevs.length} ativo(s)</span>
        </div>

        {liveDevs.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#1d2125] py-12 text-center text-white/40 text-sm font-medium">
            Nenhum desenvolvedor com jornada ativa no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {liveDevs.map((ld) => {
              const cfg = STATE_STYLES[ld.state];
              return (
                <div
                  key={ld.session.id}
                  onClick={() => navigate(`/admin/developers/${ld.dev.id}`)}
                  className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-4 cursor-pointer hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-primary flex items-center justify-center font-bold text-white shrink-0">
                      {ld.dev.avatar_url ? (
                        <img src={ld.dev.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (ld.dev.full_name || ld.dev.email).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold truncate">{ld.dev.full_name || ld.dev.email}</p>
                      <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${cfg.cls}`}>
                        <cfg.Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <span className="font-mono text-lg font-black text-white tabular-nums shrink-0">
                      {formatHMS(ld.validSeconds)}
                    </span>
                  </div>

                  {/* Atividade atual = último relatório */}
                  <div className="rounded-xl bg-black/20 border border-white/5 p-3">
                    {ld.lastReport ? (
                      <>
                        <div className="flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            Trabalhando em · {timeAgo(ld.lastReport.submitted_at)}
                          </span>
                        </div>
                        <p className="text-sm text-white/90 line-clamp-2">{ld.lastReport.content}</p>
                      </>
                    ) : (
                      <p className="text-xs text-white/40">Ainda sem relatório nesta jornada.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Projetos */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(131,52,255,0.3)]">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-white font-extrabold text-sm tracking-wider uppercase">Projetos</h2>
        </div>

        {projectSummary.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#1d2125] py-12 text-center text-white/40 text-sm font-medium">
            Nenhum projeto cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectSummary.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/quadro/${p.id}`)}
                className="group rounded-2xl border border-white/5 bg-[#1d2125] overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
              >
                {/* Capa / logo do projeto */}
                <div className="relative h-28 overflow-hidden">
                  {p.cover_image ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${p.cover_image})` }}
                    />
                  ) : p.bg_type === 'gradient' && p.background ? (
                    <div className="absolute inset-0" style={{ background: p.background }} />
                  ) : p.background ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${p.background})` }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-primary/10" />
                  )}
                  {/* Overlay para legibilidade do título */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2">
                    <h3 className="text-white font-bold truncate drop-shadow">{p.title}</h3>
                    <ArrowRight className="w-4 h-4 text-white/80 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  {p.onlineHere > 0 && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] font-bold text-emerald-400">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                      {p.onlineHere} online
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                      <span className="text-muted-foreground">{p.done}/{p.total} concluídas</span>
                      <span className="text-white">{p.progress}%</span>
                    </div>
                    <Progress value={p.progress} className="h-1.5" />
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-bold flex-wrap">
                    <span className="inline-flex items-center gap-1 text-white/70">
                      <ListChecks className="w-3.5 h-3.5" /> {p.open} abertas
                    </span>
                    {p.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5" /> {p.overdue} atrasada(s)
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-white/70">
                      <Users className="w-3.5 h-3.5" /> {p.devs} dev(s)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const ACCENTS: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  red: 'bg-red-500/10 text-red-400',
};

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: string;
}> = ({ icon: Icon, label, value, hint, accent = 'primary' }) => (
  <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-3">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ACCENTS[accent] || ACCENTS.primary}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-white/40 font-medium mt-0.5">{hint}</p>}
    </div>
  </div>
);

export default AdminDashboard;
