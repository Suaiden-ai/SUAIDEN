import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import {
  Loader2,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListChecks,
  Users as UsersIcon,
  LayoutGrid,
  Code2,
  ChevronDown,
  CheckSquare
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip
} from 'recharts';
import { Badge } from '../../components/jobs/ui/badge';
import { Progress } from '../../components/jobs/ui/progress';
import { initials, avatarColor } from '../../components/user/CardModal';

// ── Tipos ──
interface Profile { id: string; full_name: string | null; email: string; role: string; }
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

const MetricsManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [developers, setDevelopers] = useState<Profile[]>([]);
  const [boards, setBoards] = useState<{ id: string; title: string }[]>([]);
  const [colToBoard, setColToBoard] = useState<Map<string, string>>(new Map());
  const [hasTimeData, setHasTimeData] = useState(false);
  const [selectedDevId, setSelectedDevId] = useState<string>('all');
  const [selectedBoardId, setSelectedBoardId] = useState<string>('all');

  const fetchData = async () => {
    try {
      // Queries independentes: a falha de uma não pode derrubar as demais.
      const [profilesRes, boardsRes, colsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role'),
        supabase.from('boards').select('id, title'),
        supabase.from('columns').select('id, board_id'),
      ]);

      if (profilesRes.error) console.error('Métricas — profiles:', profilesRes.error);
      if (boardsRes.error) console.error('Métricas — boards:', boardsRes.error);
      if (colsRes.error) console.error('Métricas — columns:', colsRes.error);

      const profiles = (profilesRes.data as Profile[]) || [];
      setDevelopers(profiles.filter((p) => p.role === 'developer'));
      setBoards((boardsRes.data as { id: string; title: string }[]) || []);

      const map = new Map<string, string>();
      ((colsRes.data as { id: string; board_id: string }[]) || []).forEach((c) => map.set(c.id, c.board_id));
      setColToBoard(map);

      // Tasks: tenta com os timestamps; se as colunas ainda não existem
      // (migration de métricas não rodada), refaz sem elas para não perder tudo.
      let tasksData: any[] | null = null;
      const withTimestamps = await supabase
        .from('tasks')
        .select('id, column_id, title, is_done, due_date, assignees, labels, created_at, completed_at');

      if (withTimestamps.error) {
        console.error('Métricas — tasks (com timestamps):', withTimestamps.error);
        const fallback = await supabase
          .from('tasks')
          .select('id, column_id, title, is_done, due_date, assignees, labels');
        if (fallback.error) console.error('Métricas — tasks (fallback):', fallback.error);
        tasksData = fallback.data;
      } else {
        tasksData = withTimestamps.data;
      }

      const rawTasks = ((tasksData as any[]) || []).map((t) => ({
        ...t,
        is_done: !!t.is_done,
        assignees: Array.isArray(t.assignees) ? t.assignees : [],
        labels: Array.isArray(t.labels) ? t.labels : [],
      })) as TaskRow[];
      setTasks(rawTasks);
      setHasTimeData(rawTasks.some((t) => t.completed_at && t.created_at));
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const subscription = supabase
      .channel('admin-metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_activity' }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // ── Resumo geral ──
  const summary = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.is_done).length;
    const overdue = tasks.filter(isOverdue).length;
    const activeDevIds = new Set<string>();
    tasks.forEach((t) => t.assignees.forEach((a) => activeDevIds.add(a.user_id)));
    return {
      total,
      done,
      overdue,
      donePct: total ? Math.round((done / total) * 100) : 0,
      activeDevs: activeDevIds.size,
    };
  }, [tasks]);

  // ── Métricas por desenvolvedor ──
  const devMetrics = useMemo(() => {
    return developers
      .map((dev) => {
        const assigned = tasks.filter((t) => t.assignees.some((a) => a.user_id === dev.id));
        const done = assigned.filter((t) => t.is_done);
        const overdue = assigned.filter(isOverdue);

        // Tempo médio de conclusão (em dias) quando há timestamps
        const durations = done
          .filter((t) => t.completed_at && t.created_at)
          .map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at!).getTime()) / 86400000);
        const avgDays = durations.length
          ? durations.reduce((s, d) => s + d, 0) / durations.length
          : null;

        return {
          id: dev.id,
          name: dev.full_name || dev.email,
          assigned: assigned.length,
          done: done.length,
          open: assigned.length - done.length,
          overdue: overdue.length,
          completionRate: assigned.length ? Math.round((done.length / assigned.length) * 100) : 0,
          avgDays,
        };
      })
      .sort((a, b) => b.assigned - a.assigned);
  }, [developers, tasks]);

  // ── Métricas por projeto ──
  const projectMetrics = useMemo(() => {
    return boards
      .map((board) => {
        const boardTasks = tasks.filter((t) => colToBoard.get(t.column_id) === board.id);
        const done = boardTasks.filter((t) => t.is_done).length;
        const overdue = boardTasks.filter(isOverdue).length;
        const devIds = new Set<string>();
        boardTasks.forEach((t) => t.assignees.forEach((a) => devIds.add(a.user_id)));

        const priority: Record<string, number> = { BAIXA: 0, 'MÉDIA': 0, ALTA: 0 };
        boardTasks.forEach((t) =>
          t.labels.forEach((l) => {
            const key = l.text?.toUpperCase();
            if (key in priority) priority[key] += 1;
          })
        );

        return {
          id: board.id,
          title: board.title,
          total: boardTasks.length,
          done,
          overdue,
          devs: devIds.size,
          progress: boardTasks.length ? Math.round((done / boardTasks.length) * 100) : 0,
          priority,
        };
      })
      .filter((p) => p.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [boards, tasks, colToBoard]);

  // ── Tasks atrasadas (lista) ──
  const overdueTasks = useMemo(() => {
    return tasks
      .filter(isOverdue)
      .map((t) => ({
        id: t.id,
        title: t.title,
        due_date: t.due_date!,
        board: boards.find((b) => b.id === colToBoard.get(t.column_id))?.title || '—',
        assignees: t.assignees.map((a) => a.full_name).join(', ') || 'Sem responsável',
      }))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [tasks, boards, colToBoard]);

  const devChartData = devMetrics.filter((d) => d.assigned > 0).map((d) => ({
    name: d.name.split(' ')[0],
    Concluídas: d.done,
    'Em aberto': d.open,
  }));

  // ── Detalhamento de um desenvolvedor específico ──
  const selectedDev = selectedDevId === 'all' ? null : developers.find((d) => d.id === selectedDevId) || null;

  const devDetail = useMemo(() => {
    if (!selectedDev) return null;

    const assigned = tasks.filter((t) => t.assignees.some((a) => a.user_id === selectedDev.id));
    const done = assigned.filter((t) => t.is_done);
    const overdue = assigned.filter(isOverdue);

    const durations = done
      .filter((t) => t.completed_at && t.created_at)
      .map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at!).getTime()) / 86400000);
    const avgDays = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null;

    // Tasks dele agrupadas por projeto
    const byBoard = new Map<string, { title: string; total: number; done: number; overdue: number }>();
    assigned.forEach((t) => {
      const boardId = colToBoard.get(t.column_id);
      const board = boards.find((b) => b.id === boardId);
      if (!board) return;
      const entry = byBoard.get(board.id) || { title: board.title, total: 0, done: 0, overdue: 0 };
      entry.total += 1;
      if (t.is_done) entry.done += 1;
      if (isOverdue(t)) entry.overdue += 1;
      byBoard.set(board.id, entry);
    });
    const projects = Array.from(byBoard.entries())
      .map(([id, v]) => ({ id, ...v, progress: v.total ? Math.round((v.done / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);

    // Lista de tasks dele
    const taskList = assigned
      .map((t) => ({
        id: t.id,
        title: t.title,
        is_done: t.is_done,
        overdue: isOverdue(t),
        due_date: t.due_date,
        board: boards.find((b) => b.id === colToBoard.get(t.column_id))?.title || '—',
      }))
      .sort((a, b) => {
        // Atrasadas primeiro, depois em aberto, depois concluídas
        const rank = (x: typeof a) => (x.overdue ? 0 : x.is_done ? 2 : 1);
        return rank(a) - rank(b);
      });

    return {
      name: selectedDev.full_name || selectedDev.email,
      email: selectedDev.email,
      assigned: assigned.length,
      done: done.length,
      open: assigned.length - done.length,
      overdue: overdue.length,
      completionRate: assigned.length ? Math.round((done.length / assigned.length) * 100) : 0,
      avgDays,
      projects,
      taskList,
      chartData: [{ name: selectedDev.full_name?.split(' ')[0] || 'Dev', Concluídas: done.length, 'Em aberto': assigned.length - done.length }],
    };
  }, [selectedDev, tasks, boards, colToBoard]);

  // ── Detalhamento de um projeto específico ──
  const selectedBoard = selectedBoardId === 'all' ? null : boards.find((b) => b.id === selectedBoardId) || null;

  const boardDetail = useMemo(() => {
    if (!selectedBoard) return null;

    const boardTasks = tasks.filter((t) => colToBoard.get(t.column_id) === selectedBoard.id);
    const done = boardTasks.filter((t) => t.is_done);
    const overdue = boardTasks.filter(isOverdue);

    const durations = done
      .filter((t) => t.completed_at && t.created_at)
      .map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at!).getTime()) / 86400000);
    const avgDays = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null;

    // Distribuição de prioridade
    const priority: Record<string, number> = { BAIXA: 0, 'MÉDIA': 0, ALTA: 0 };
    boardTasks.forEach((t) =>
      t.labels.forEach((l) => {
        const key = l.text?.toUpperCase();
        if (key in priority) priority[key] += 1;
      })
    );

    // Tasks do projeto agrupadas por desenvolvedor
    const byDev = new Map<string, { name: string; total: number; done: number; overdue: number }>();
    boardTasks.forEach((t) => {
      t.assignees.forEach((a) => {
        const entry = byDev.get(a.user_id) || { name: a.full_name, total: 0, done: 0, overdue: 0 };
        entry.total += 1;
        if (t.is_done) entry.done += 1;
        if (isOverdue(t)) entry.overdue += 1;
        byDev.set(a.user_id, entry);
      });
    });
    const devs = Array.from(byDev.entries())
      .map(([id, v]) => ({ id, ...v, progress: v.total ? Math.round((v.done / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);

    // Lista de tasks do projeto
    const taskList = boardTasks
      .map((t) => ({
        id: t.id,
        title: t.title,
        is_done: t.is_done,
        overdue: isOverdue(t),
        due_date: t.due_date,
        board: t.assignees.map((a) => a.full_name).join(', ') || 'Sem responsável',
      }))
      .sort((a, b) => {
        const rank = (x: typeof a) => (x.overdue ? 0 : x.is_done ? 2 : 1);
        return rank(a) - rank(b);
      });

    return {
      name: selectedBoard.title,
      email: `${boardTasks.length} task${boardTasks.length === 1 ? '' : 's'} · ${devs.length} desenvolvedor${devs.length === 1 ? '' : 'es'}`,
      assigned: boardTasks.length,
      done: done.length,
      open: boardTasks.length - done.length,
      overdue: overdue.length,
      completionRate: boardTasks.length ? Math.round((done.length / boardTasks.length) * 100) : 0,
      avgDays,
      priority,
      devs,
      taskList,
      chartData: [{ name: selectedBoard.title.split(' ')[0], Concluídas: done.length, 'Em aberto': boardTasks.length - done.length }],
    };
  }, [selectedBoard, tasks, boards, colToBoard]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b border-white/5">
        <div className="space-y-4">
          <Badge
            variant="tech"
            className="px-4 py-1.5 bg-primary/20 border-primary/40 text-primary font-black uppercase tracking-widest text-[10px]"
          >
            Análise de Desempenho
          </Badge>
          <h1 className="text-5xl font-black tracking-tight text-white italic">Métricas</h1>
          <p className="text-muted-foreground text-xl max-w-xl">
            Desempenho de desenvolvedores, progresso dos projetos e prazos.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Seletor de desenvolvedor */}
            <div className="relative">
              <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
              <select
                value={selectedDevId}
                onChange={(e) => {
                  setSelectedDevId(e.target.value);
                  if (e.target.value !== 'all') setSelectedBoardId('all');
                }}
                className="appearance-none pl-9 pr-9 h-10 bg-black/30 border border-white/10 focus:border-primary/50 rounded-xl text-sm font-bold text-white outline-none cursor-pointer min-w-[200px]"
              >
                <option value="all">Todos os desenvolvedores</option>
                {developers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name || d.email}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Seletor de projeto */}
            <div className="relative">
              <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
              <select
                value={selectedBoardId}
                onChange={(e) => {
                  setSelectedBoardId(e.target.value);
                  if (e.target.value !== 'all') setSelectedDevId('all');
                }}
                className="appearance-none pl-9 pr-9 h-10 bg-black/30 border border-white/10 focus:border-primary/50 rounded-xl text-sm font-bold text-white outline-none cursor-pointer min-w-[200px]"
              >
                <option value="all">Todos os projetos</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-white/70">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold">
              {selectedDev
                ? `${devDetail?.assigned ?? 0} tasks`
                : selectedBoard
                ? `${boardDetail?.assigned ?? 0} tasks`
                : `${summary.total} tasks`}
            </span>
          </div>
        </div>
      </div>

      {selectedDev && devDetail ? (
        <DevDetailPanel detail={devDetail} hasTimeData={hasTimeData} />
      ) : selectedBoard && boardDetail ? (
        <BoardDetailPanel detail={boardDetail} hasTimeData={hasTimeData} />
      ) : (
      <>
      {/* Cards-resumo */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={ListChecks} label="Total de tasks" value={summary.total} />
        <SummaryCard
          icon={CheckCircle2}
          label="Concluídas"
          value={`${summary.done} (${summary.donePct}%)`}
          accent="text-emerald-400"
        />
        <SummaryCard icon={AlertTriangle} label="Atrasadas" value={summary.overdue} accent="text-red-400" />
        <SummaryCard icon={UsersIcon} label="Devs ativos" value={summary.activeDevs} />
      </section>

      {!hasTimeData && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-sm">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Métricas de tempo de conclusão ficam disponíveis para tasks concluídas após a ativação do
            registro de datas no banco. Os demais números já refletem o estado atual.
          </p>
        </div>
      )}

      {/* Gráfico: tasks por desenvolvedor */}
      {devChartData.length > 0 && (
        <section className="space-y-4">
          <SectionTitle icon={Code2} title="Tasks por desenvolvedor" />
          <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={devChartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="Concluídas" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Em aberto" stackId="a" fill="#8334ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Tabela por desenvolvedor */}
      <section className="space-y-4">
        <SectionTitle icon={Code2} title="Desempenho por desenvolvedor" />
        {devMetrics.length === 0 ? (
          <EmptyState text="Nenhum desenvolvedor cadastrado." />
        ) : (
          <div className="space-y-3">
            {devMetrics.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 md:w-56 shrink-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                    style={{ backgroundColor: avatarColor(d.id) }}
                  >
                    {initials(d.name)}
                  </div>
                  <span className="text-white font-bold truncate">{d.name}</span>
                </div>

                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <Stat label="Atribuídas" value={d.assigned} />
                  <Stat label="Concluídas" value={d.done} accent="text-emerald-400" />
                  <Stat label="Em aberto" value={d.open} />
                  <Stat label="Atrasadas" value={d.overdue} accent={d.overdue ? 'text-red-400' : undefined} />
                </div>

                <div className="md:w-48 shrink-0 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-bold">
                    <span>Conclusão</span>
                    <span className="text-white">{d.completionRate}%</span>
                  </div>
                  <Progress value={d.completionRate} className="h-2 bg-white/10" />
                  {d.avgDays !== null && (
                    <p className="text-[11px] text-muted-foreground">
                      Tempo médio: <span className="text-white font-bold">{d.avgDays.toFixed(1)} dias</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Por projeto */}
      <section className="space-y-4">
        <SectionTitle icon={LayoutGrid} title="Desempenho por projeto" />
        {projectMetrics.length === 0 ? (
          <EmptyState text="Nenhum projeto com tasks." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectMetrics.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-4">
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
                <div className="flex items-center gap-2 pt-1">
                  {(['BAIXA', 'MÉDIA', 'ALTA'] as const).map((key) => (
                    <div key={key} className="flex items-center gap-1 text-[11px] font-bold">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[key] }} />
                      <span className="text-muted-foreground">{p.priority[key]}</span>
                    </div>
                  ))}
                  <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground font-bold">
                    <Code2 className="w-3.5 h-3.5 text-primary" />
                    {p.devs} dev{p.devs === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Prazos / atrasos */}
      <section className="space-y-4">
        <SectionTitle icon={AlertTriangle} title={`Tasks atrasadas (${overdueTasks.length})`} />
        {overdueTasks.length === 0 ? (
          <EmptyState text="Nenhuma task atrasada. 🎉" />
        ) : (
          <div className="rounded-2xl border border-white/5 bg-[#1d2125] divide-y divide-white/5">
            {overdueTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-4">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {t.board} · {t.assignees}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-red-400 shrink-0">
                  {new Date(t.due_date.split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
};

// ── Subcomponentes ──
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

const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent = 'text-white' }) => (
  <div>
    <p className={`text-lg font-black ${accent}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
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

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl border border-white/5 bg-[#1d2125] py-12 text-center text-white/40 text-sm font-medium">
    {text}
  </div>
);

// ── Painel detalhado de um desenvolvedor ──
interface DevDetail {
  name: string;
  email: string;
  assigned: number;
  done: number;
  open: number;
  overdue: number;
  completionRate: number;
  avgDays: number | null;
  projects: { id: string; title: string; total: number; done: number; overdue: number; progress: number }[];
  taskList: { id: string; title: string; is_done: boolean; overdue: boolean; due_date: string | null; board: string }[];
  chartData: { name: string; Concluídas: number; 'Em aberto': number }[];
}

const DevDetailPanel: React.FC<{ detail: DevDetail; hasTimeData: boolean }> = ({ detail, hasTimeData }) => (
  <>
    {/* Identificação */}
    <div className="flex items-center gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-black text-white shrink-0"
        style={{ backgroundColor: avatarColor(detail.name) }}
      >
        {initials(detail.name)}
      </div>
      <div className="min-w-0">
        <h2 className="text-2xl font-black text-white truncate">{detail.name}</h2>
        <p className="text-sm text-muted-foreground truncate">{detail.email}</p>
      </div>
    </div>

    {/* Cards-resumo do dev */}
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard icon={ListChecks} label="Atribuídas" value={detail.assigned} />
      <SummaryCard icon={CheckCircle2} label="Concluídas" value={`${detail.done} (${detail.completionRate}%)`} accent="text-emerald-400" />
      <SummaryCard icon={CheckSquare} label="Em aberto" value={detail.open} />
      <SummaryCard icon={AlertTriangle} label="Atrasadas" value={detail.overdue} accent={detail.overdue ? 'text-red-400' : 'text-white'} />
    </section>

    {/* Conclusão + tempo médio */}
    <section className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-3">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="text-muted-foreground">Taxa de conclusão</span>
        <span className="text-white">{detail.completionRate}%</span>
      </div>
      <Progress value={detail.completionRate} className="h-2.5 bg-white/10" />
      {detail.avgDays !== null && (
        <p className="text-xs text-muted-foreground pt-1">
          Tempo médio de conclusão: <span className="text-white font-bold">{detail.avgDays.toFixed(1)} dias</span>
        </p>
      )}
      {!hasTimeData && (
        <p className="text-xs text-amber-300/80 pt-1">
          O tempo médio aparece após a ativação do registro de datas no banco.
        </p>
      )}
    </section>

    {/* Gráfico de progresso */}
    {detail.assigned > 0 && (
      <section className="space-y-4">
        <SectionTitle icon={BarChart3} title="Progresso" />
        <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={detail.chartData} layout="vertical" barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={80} />
              <RechartsTooltip
                contentStyle={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="Concluídas" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Em aberto" stackId="a" fill="#8334ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    )}

    {/* Tasks por projeto */}
    <section className="space-y-4">
      <SectionTitle icon={LayoutGrid} title="Tasks por projeto" />
      {detail.projects.length === 0 ? (
        <EmptyState text="Sem tasks atribuídas em nenhum projeto." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {detail.projects.map((p) => (
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
      <SectionTitle icon={ListChecks} title={`Tasks do desenvolvedor (${detail.taskList.length})`} />
      {detail.taskList.length === 0 ? (
        <EmptyState text="Nenhuma task atribuída." />
      ) : (
        <div className="rounded-2xl border border-white/5 bg-[#1d2125] divide-y divide-white/5">
          {detail.taskList.map((t) => (
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
  </>
);

// ── Painel detalhado de um projeto ──
interface BoardDetail {
  name: string;
  email: string;
  assigned: number;
  done: number;
  open: number;
  overdue: number;
  completionRate: number;
  avgDays: number | null;
  priority: Record<string, number>;
  devs: { id: string; name: string; total: number; done: number; overdue: number; progress: number }[];
  taskList: { id: string; title: string; is_done: boolean; overdue: boolean; due_date: string | null; board: string }[];
  chartData: { name: string; Concluídas: number; 'Em aberto': number }[];
}

const BoardDetailPanel: React.FC<{ detail: BoardDetail; hasTimeData: boolean }> = ({ detail, hasTimeData }) => (
  <>
    {/* Identificação */}
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/15 border border-primary/30 shrink-0">
        <LayoutGrid className="w-6 h-6 text-primary" />
      </div>
      <div className="min-w-0">
        <h2 className="text-2xl font-black text-white truncate">{detail.name}</h2>
        <p className="text-sm text-muted-foreground truncate">{detail.email}</p>
      </div>
    </div>

    {/* Cards-resumo do projeto */}
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard icon={ListChecks} label="Total de tasks" value={detail.assigned} />
      <SummaryCard icon={CheckCircle2} label="Concluídas" value={`${detail.done} (${detail.completionRate}%)`} accent="text-emerald-400" />
      <SummaryCard icon={CheckSquare} label="Em aberto" value={detail.open} />
      <SummaryCard icon={AlertTriangle} label="Atrasadas" value={detail.overdue} accent={detail.overdue ? 'text-red-400' : 'text-white'} />
    </section>

    {/* Progresso + tempo médio + prioridade */}
    <section className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 space-y-3">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="text-muted-foreground">Progresso do projeto</span>
        <span className="text-white">{detail.completionRate}%</span>
      </div>
      <Progress value={detail.completionRate} className="h-2.5 bg-white/10" />
      <div className="flex items-center gap-4 pt-1">
        {(['BAIXA', 'MÉDIA', 'ALTA'] as const).map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[key] }} />
            <span className="text-muted-foreground">{key}</span>
            <span className="text-white">{detail.priority[key]}</span>
          </div>
        ))}
      </div>
      {detail.avgDays !== null && (
        <p className="text-xs text-muted-foreground pt-1">
          Tempo médio de conclusão: <span className="text-white font-bold">{detail.avgDays.toFixed(1)} dias</span>
        </p>
      )}
      {!hasTimeData && (
        <p className="text-xs text-amber-300/80 pt-1">
          O tempo médio aparece após a ativação do registro de datas no banco.
        </p>
      )}
    </section>

    {/* Gráfico de progresso */}
    {detail.assigned > 0 && (
      <section className="space-y-4">
        <SectionTitle icon={BarChart3} title="Progresso" />
        <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={detail.chartData} layout="vertical" barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={80} />
              <RechartsTooltip
                contentStyle={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="Concluídas" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Em aberto" stackId="a" fill="#8334ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    )}

    {/* Tasks por desenvolvedor */}
    <section className="space-y-4">
      <SectionTitle icon={Code2} title="Tasks por desenvolvedor" />
      {detail.devs.length === 0 ? (
        <EmptyState text="Nenhuma task atribuída a desenvolvedores neste projeto." />
      ) : (
        <div className="space-y-3">
          {detail.devs.map((d) => (
            <div key={d.id} className="rounded-2xl border border-white/5 bg-[#1d2125] p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 md:w-56 shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{ backgroundColor: avatarColor(d.id) }}
                >
                  {initials(d.name)}
                </div>
                <span className="text-white font-bold truncate">{d.name}</span>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-3 text-center">
                <Stat label="Atribuídas" value={d.total} />
                <Stat label="Concluídas" value={d.done} accent="text-emerald-400" />
                <Stat label="Atrasadas" value={d.overdue} accent={d.overdue ? 'text-red-400' : undefined} />
              </div>
              <div className="md:w-48 shrink-0 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-bold">
                  <span>Conclusão</span>
                  <span className="text-white">{d.progress}%</span>
                </div>
                <Progress value={d.progress} className="h-2 bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>

    {/* Lista de tasks do projeto */}
    <section className="space-y-4">
      <SectionTitle icon={ListChecks} title={`Tasks do projeto (${detail.taskList.length})`} />
      {detail.taskList.length === 0 ? (
        <EmptyState text="Nenhuma task neste projeto." />
      ) : (
        <div className="rounded-2xl border border-white/5 bg-[#1d2125] divide-y divide-white/5">
          {detail.taskList.map((t) => (
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
  </>
);

export default MetricsManagement;
