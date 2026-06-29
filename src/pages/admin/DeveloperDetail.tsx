import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft,
  Loader2,
  Clock,
  ListChecks,
  BarChart3,
  LayoutGrid,
  Mail,
  CheckCircle2,
  AlertTriangle,
  CheckSquare,
  Crown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Badge } from '../../components/jobs/ui/badge';
import { Progress } from '../../components/jobs/ui/progress';
import DeveloperJourneyPanel from '../../components/admin/DeveloperJourneyPanel';
import DeveloperDailyHistory from '../../components/admin/DeveloperDailyHistory';

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}
interface TaskRow {
  id: string;
  column_id: string;
  title: string;
  is_done: boolean;
  due_date: string | null;
  assignees: { user_id: string; full_name: string }[];
  labels: { text: string; color: string }[];
  created_at?: string | null;
  completed_at?: string | null;
}
interface ProjectInfo {
  id: string;
  title: string;
  isOwner: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  BAIXA: '#22c55e',
  'MÉDIA': '#eab308',
  ALTA: '#ef4444',
};

const isOverdue = (t: TaskRow) => {
  if (t.is_done || !t.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(t.due_date.split('T')[0] + 'T00:00:00');
  return d < today;
};

const getInitials = (name: string) =>
  name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

type Tab = 'time' | 'tasks' | 'metrics' | 'projects';

const DeveloperDetail: React.FC = () => {
  const { id: devId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dev, setDev] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [boards, setBoards] = useState<{ id: string; title: string; owner_id: string }[]>([]);
  const [memberBoardIds, setMemberBoardIds] = useState<string[]>([]);
  const [colToBoard, setColToBoard] = useState<Map<string, string>>(new Map());
  const [tab, setTab] = useState<Tab>('time');

  useEffect(() => {
    if (!devId) return;
    const fetchData = async () => {
      try {
        const [profileRes, boardsRes, membersRes, colsRes, tasksRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email, role').eq('id', devId).maybeSingle(),
          supabase.from('boards').select('id, title, owner_id'),
          supabase.from('board_members').select('board_id, user_id').eq('user_id', devId),
          supabase.from('columns').select('id, board_id'),
          supabase.from('tasks').select('id, column_id, title, is_done, due_date, assignees, labels, created_at, completed_at'),
        ]);

        if (boardsRes.error) console.error('DevDetail — boards:', boardsRes.error);
        if (membersRes.error) console.error('DevDetail — board_members:', membersRes.error);
        if (colsRes.error) console.error('DevDetail — columns:', colsRes.error);
        if (tasksRes.error) console.error('DevDetail — tasks:', tasksRes.error);

        setDev((profileRes.data as Profile | null) ?? null);
        setBoards((boardsRes.data as { id: string; title: string; owner_id: string }[]) || []);
        setMemberBoardIds(((membersRes.data as { board_id: string }[]) || []).map((m) => m.board_id));

        const map = new Map<string, string>();
        ((colsRes.data as { id: string; board_id: string }[]) || []).forEach((c) => map.set(c.id, c.board_id));
        setColToBoard(map);

        const rawTasks = ((tasksRes.data as any[]) || []).map((t) => ({
          ...t,
          is_done: !!t.is_done,
          assignees: Array.isArray(t.assignees) ? t.assignees : [],
          labels: Array.isArray(t.labels) ? t.labels : [],
        })) as TaskRow[];
        setTasks(rawTasks);
      } catch (err) {
        console.error('Erro ao carregar detalhe do desenvolvedor:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [devId]);

  // Tasks atribuídas ao dev
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assignees.some((a) => a.user_id === devId)),
    [tasks, devId]
  );

  const boardTitle = (colId: string) =>
    boards.find((b) => b.id === colToBoard.get(colId))?.title || '—';

  // Métricas agregadas
  const metrics = useMemo(() => {
    const done = myTasks.filter((t) => t.is_done);
    const overdue = myTasks.filter(isOverdue);
    const durations = done
      .filter((t) => t.completed_at && t.created_at)
      .map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at!).getTime()) / 86400000);
    const avgDays = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null;
    const priority: Record<string, number> = { BAIXA: 0, 'MÉDIA': 0, ALTA: 0 };
    myTasks.forEach((t) =>
      t.labels.forEach((l) => {
        const k = l.text?.toUpperCase();
        if (k in priority) priority[k] += 1;
      })
    );
    return {
      total: myTasks.length,
      done: done.length,
      open: myTasks.length - done.length,
      overdue: overdue.length,
      completionRate: myTasks.length ? Math.round((done.length / myTasks.length) * 100) : 0,
      avgDays,
      priority,
      chartData: [{ name: 'Tarefas', Concluídas: done.length, 'Em aberto': myTasks.length - done.length }],
    };
  }, [myTasks]);

  // Tasks do dev agrupadas por projeto (com progresso) — igual à página de métricas.
  const tasksByProject = useMemo(() => {
    const m = new Map<string, { id: string; title: string; total: number; done: number; overdue: number }>();
    myTasks.forEach((t) => {
      const bId = colToBoard.get(t.column_id);
      const b = boards.find((x) => x.id === bId);
      if (!b) return;
      const e = m.get(b.id) || { id: b.id, title: b.title, total: 0, done: 0, overdue: 0 };
      e.total += 1;
      if (t.is_done) e.done += 1;
      if (isOverdue(t)) e.overdue += 1;
      m.set(b.id, e);
    });
    return Array.from(m.values())
      .map((p) => ({ ...p, progress: p.total ? Math.round((p.done / p.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [myTasks, boards, colToBoard]);

  const hasTimeData = useMemo(
    () => myTasks.some((t) => t.completed_at && t.created_at),
    [myTasks]
  );

  // Projetos do dev: dono, membro do board, ou tem task atribuída.
  const projects = useMemo<ProjectInfo[]>(() => {
    const m = new Map<string, ProjectInfo>();
    // dono
    boards.filter((b) => b.owner_id === devId).forEach((b) => m.set(b.id, { id: b.id, title: b.title, isOwner: true }));
    // membro
    memberBoardIds.forEach((bId) => {
      const b = boards.find((x) => x.id === bId);
      if (b && !m.has(b.id)) m.set(b.id, { id: b.id, title: b.title, isOwner: false });
    });
    // tem task atribuída
    myTasks.forEach((t) => {
      const bId = colToBoard.get(t.column_id);
      const b = boards.find((x) => x.id === bId);
      if (b && !m.has(b.id)) m.set(b.id, { id: b.id, title: b.title, isOwner: false });
    });
    return Array.from(m.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [boards, memberBoardIds, myTasks, colToBoard, devId]);

  // Lista de tasks ordenada (atrasadas → abertas → concluídas)
  const taskList = useMemo(
    () =>
      [...myTasks]
        .map((t) => ({ ...t, overdue: isOverdue(t), board: boardTitle(t.column_id) }))
        .sort((a, b) => {
          const rank = (x: { overdue: boolean; is_done: boolean }) => (x.overdue ? 0 : x.is_done ? 2 : 1);
          return rank(a) - rank(b);
        }),
    [myTasks] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!dev) {
    return (
      <div className="space-y-6">
        <BackButton onClick={() => navigate('/admin/developers')} />
        <p className="text-white/50">Desenvolvedor não encontrado.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'time', label: 'Gestão de tempo', icon: Clock },
    { key: 'tasks', label: 'Gestão de tarefas', icon: ListChecks },
    { key: 'metrics', label: 'Métricas', icon: BarChart3 },
    { key: 'projects', label: 'Projetos', icon: LayoutGrid },
  ];

  return (
    <div className="space-y-8">
      <BackButton onClick={() => navigate('/admin/developers')} />

      {/* Cabeçalho do dev */}
      <div className="flex items-center gap-4 pb-6 border-b border-white/5">
        <div className="w-16 h-16 shrink-0 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-black text-xl">
          {getInitials(dev.full_name || dev.email)}
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-white truncate">{dev.full_name || 'Sem nome'}</h1>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
            <Mail className="w-3.5 h-3.5" />
            <span className="truncate">{dev.email}</span>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/10 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.key ? 'bg-primary text-white shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {tab === 'time' && (
        <div className="space-y-5">
          <DeveloperJourneyPanel devId={dev.id} />
          <DeveloperDailyHistory devId={dev.id} />
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={ListChecks} label="Total" value={metrics.total} />
            <SummaryCard icon={CheckCircle2} label="Concluídas" value={metrics.done} accent="text-emerald-400" />
            <SummaryCard icon={CheckSquare} label="Em aberto" value={metrics.open} />
            <SummaryCard icon={AlertTriangle} label="Atrasadas" value={metrics.overdue} accent={metrics.overdue ? 'text-red-400' : 'text-white'} />
          </div>
          {taskList.length === 0 ? (
            <Empty text="Nenhuma tarefa atribuída a este desenvolvedor." />
          ) : (
            <div className="rounded-2xl border border-white/5 bg-[#1d2125] divide-y divide-white/5">
              {taskList.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const bId = colToBoard.get(t.column_id);
                    if (bId) navigate(`/quadro/${bId}`);
                  }}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors text-left"
                >
                  {t.is_done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : t.overdue ? (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <CheckSquare className="w-4 h-4 text-white/40 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${t.is_done ? 'text-muted-foreground line-through' : 'text-white'}`}>
                      {t.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{t.board}</p>
                  </div>
                  {t.due_date && (
                    <span className={`text-[11px] font-bold shrink-0 ${t.overdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {new Date(t.due_date.split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'metrics' && (
        <div className="space-y-6">
          {/* Cards-resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={ListChecks} label="Atribuídas" value={metrics.total} />
            <SummaryCard icon={CheckCircle2} label="Concluídas" value={`${metrics.done} (${metrics.completionRate}%)`} accent="text-emerald-400" />
            <SummaryCard icon={CheckSquare} label="Em aberto" value={metrics.open} />
            <SummaryCard icon={AlertTriangle} label="Atrasadas" value={metrics.overdue} accent={metrics.overdue ? 'text-red-400' : 'text-white'} />
          </div>

          {/* Conclusão + tempo médio + prioridade */}
          <section className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-3">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-muted-foreground">Taxa de conclusão</span>
              <span className="text-white">{metrics.completionRate}%</span>
            </div>
            <Progress value={metrics.completionRate} className="h-2.5 bg-white/10" />
            <div className="flex items-center gap-4 pt-1">
              {(['BAIXA', 'MÉDIA', 'ALTA'] as const).map((k) => (
                <div key={k} className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[k] }} />
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-white">{metrics.priority[k]}</span>
                </div>
              ))}
            </div>
            {metrics.avgDays !== null && (
              <p className="text-xs text-muted-foreground pt-1">
                Tempo médio de conclusão: <span className="text-white font-bold">{metrics.avgDays.toFixed(1)} dias</span>
              </p>
            )}
            {!hasTimeData && (
              <p className="text-xs text-amber-300/80 pt-1">
                O tempo médio aparece após a ativação do registro de datas no banco.
              </p>
            )}
          </section>

          {/* Gráfico de progresso */}
          {metrics.total > 0 && (
            <section className="space-y-4">
              <SectionTitle icon={BarChart3} title="Progresso" />
              <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.chartData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={80} />
                    <RechartsTooltip
                      contentStyle={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="Concluídas" stackId="a" fill="#22c55e" />
                    <Bar dataKey="Em aberto" stackId="a" fill="#8334ff" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Tasks por projeto */}
          <section className="space-y-4">
            <SectionTitle icon={LayoutGrid} title="Tasks por projeto" />
            {tasksByProject.length === 0 ? (
              <Empty text="Sem tasks atribuídas em nenhum projeto." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tasksByProject.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-bold truncate">{p.title}</h3>
                      <Badge variant="tech" className="shrink-0 bg-primary/10 border-primary/30 text-primary text-[10px]">
                        {p.progress}%
                      </Badge>
                    </div>
                    <Progress value={p.progress} className="h-2 bg-white/10" />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Stat label="Total" value={p.total} />
                      <Stat label="Feitas" value={p.done} accent="text-emerald-400" />
                      <Stat label="Atrasadas" value={p.overdue} accent={p.overdue ? 'text-red-400' : undefined} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Lista de tasks */}
          <section className="space-y-4">
            <SectionTitle icon={ListChecks} title={`Tasks do desenvolvedor (${taskList.length})`} />
            {taskList.length === 0 ? (
              <Empty text="Nenhuma task atribuída." />
            ) : (
              <div className="rounded-2xl border border-white/5 bg-[#1d2125] divide-y divide-white/5">
                {taskList.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-4">
                    {t.is_done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : t.overdue ? (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <CheckSquare className="w-4 h-4 text-white/40 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${t.is_done ? 'text-muted-foreground line-through' : 'text-white'}`}>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{t.board}</p>
                    </div>
                    {t.due_date && (
                      <span className={`text-[11px] font-bold shrink-0 ${t.overdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {new Date(t.due_date.split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'projects' && (
        <div>
          {projects.length === 0 ? (
            <Empty text="Este desenvolvedor não está vinculado a nenhum projeto." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/quadro/${p.id}`)}
                  className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-primary/30 hover:bg-white/[0.04] transition-all text-left"
                >
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LayoutGrid className="w-4 h-4 text-primary" />
                  </div>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-white/90 group-hover:text-white truncate">
                    {p.title}
                  </span>
                  {p.isOwner && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-white transition-colors"
  >
    <ArrowLeft className="w-4 h-4" />
    Voltar para desenvolvedores
  </button>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = 'text-white' }) => (
  <div>
    <p className={`text-lg font-black ${accent}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
  </div>
);

const SummaryCard: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; accent?: string }> = ({
  icon: Icon,
  label,
  value,
  accent = 'text-white',
}) => (
  <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-3">
    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div>
      <p className={`text-2xl font-black ${accent}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  </div>
);

const SectionTitle: React.FC<{ icon: React.ElementType; title: string }> = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
    <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(131,52,255,0.3)]">
      <Icon className="w-4 h-4 text-white" />
    </div>
    <h2 className="text-white font-extrabold text-sm tracking-wider uppercase">{title}</h2>
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl border border-white/5 bg-[#1d2125] py-12 text-center text-white/40 text-sm font-medium">
    {text}
  </div>
);

export default DeveloperDetail;
