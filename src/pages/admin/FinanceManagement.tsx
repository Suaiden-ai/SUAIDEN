import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import {
  Loader2,
  Wallet,
  Code2,
  Wrench,
  TrendingUp,
  AlertTriangle,
  CalendarClock,
  CreditCard,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Plus,
  Pencil,
  Trash2,
  Receipt,
  CheckCircle2,
  Clock,
  Power,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Badge } from '../../components/jobs/ui/badge';
import { Button } from '../../components/jobs/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/jobs/ui/tabs';
import FinanceItemModal, {
  type FinanceItem,
  type FinanceCategory,
  type FinanceRecurrence,
} from '../../components/admin/FinanceItemModal';
import FinanceEntryModal from '../../components/admin/FinanceEntryModal';
import FinanceRevenueModal, {
  type FinanceRevenue,
} from '../../components/admin/FinanceRevenueModal';

// ── Tipos locais ──
type FinancePeriod = 'full' | 'first_half' | 'second_half';

interface FinanceEntry {
  id: string;
  item_id: string | null;
  category: FinanceCategory;
  name: string;
  competence: string; // YYYY-MM-DD
  amount: number;
  flagged: boolean;
  period: FinancePeriod;
  pay_day: number | null;
}

const PERIOD_LABEL: Record<FinancePeriod, string> = {
  full: 'Mensal',
  first_half: '1ª quinzena',
  second_half: '2ª quinzena',
};

// ── Helpers ──
const fmtUSD = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const RECURRENCE_LABEL: Record<FinanceRecurrence, string> = {
  fixed: 'Fixo',
  monthly: 'Mensal',
  biweekly: 'Quinzenal',
  annual: 'Anual',
  one_time: 'Único',
};

const monthKey = (competence: string) => competence.slice(0, 7); // YYYY-MM
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
};

const FinanceManagement: React.FC = () => {
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [revenues, setRevenues] = useState<FinanceRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // mês selecionado (YYYY-MM) para ver o detalhe dos gastos
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Estado dos modais
  const [itemModal, setItemModal] = useState<{ open: boolean; category: FinanceCategory; item: FinanceItem | null }>({
    open: false,
    category: 'developer',
    item: null,
  });
  const [entryModal, setEntryModal] = useState<{ open: boolean; item: FinanceItem | null }>({
    open: false,
    item: null,
  });
  const [revenueModal, setRevenueModal] = useState<{ open: boolean; revenue: FinanceRevenue | null }>({
    open: false,
    revenue: null,
  });

  const fetchData = async () => {
    try {
      const [itemsRes, entriesRes, revenuesRes] = await Promise.all([
        supabase
          .from('finance_items')
          .select('id, category, name, recurrence, base_amount, currency, due_day, billing_source, active, notes')
          .order('category', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('finance_entries')
          .select('id, item_id, category, name, competence, amount, flagged, period, pay_day')
          .order('competence', { ascending: true }),
        supabase
          .from('finance_revenues')
          .select('id, source, description, competence, amount, received, received_at')
          .order('competence', { ascending: false }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (revenuesRes.error) throw revenuesRes.error;

      setItems((itemsRes.data || []).map((i) => ({ ...i, base_amount: Number(i.base_amount) })));
      setEntries((entriesRes.data || []).map((e) => ({ ...e, amount: Number(e.amount) })));
      setRevenues((revenuesRes.data || []).map((r) => ({ ...r, amount: Number(r.amount) })));
    } catch (err: any) {
      console.error('Erro ao carregar dados financeiros:', err);
      setError(err?.message || 'Falha ao carregar dados financeiros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Ações de exclusão ──
  const deleteItem = async (item: FinanceItem) => {
    if (!confirm(`Excluir "${item.name}" e todos os seus lançamentos? Esta ação não pode ser desfeita.`)) return;
    const { error: err } = await supabase.from('finance_items').delete().eq('id', item.id);
    if (err) {
      alert('Falha ao excluir: ' + err.message);
      return;
    }
    fetchData();
  };

  // Alterna ativo/inativo direto no card (atualização otimista).
  const toggleActive = async (item: FinanceItem) => {
    const next = !item.active;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: next } : i)));
    const { error: err } = await supabase
      .from('finance_items')
      .update({ active: next })
      .eq('id', item.id);
    if (err) {
      alert('Falha ao atualizar status: ' + err.message);
      fetchData(); // reverte para o estado real
    }
  };

  const deleteRevenue = async (rev: FinanceRevenue) => {
    if (!confirm(`Excluir a receita "${rev.source}"?`)) return;
    const { error: err } = await supabase.from('finance_revenues').delete().eq('id', rev.id);
    if (err) {
      alert('Falha ao excluir: ' + err.message);
      return;
    }
    fetchData();
  };

  // ── Agregações ──
  const stats = useMemo(() => {
    const total = entries.reduce((s, e) => s + e.amount, 0);
    const devs = entries.filter((e) => e.category === 'developer').reduce((s, e) => s + e.amount, 0);
    const tools = entries.filter((e) => e.category === 'tool').reduce((s, e) => s + e.amount, 0);
    const months = new Set(entries.map((e) => monthKey(e.competence)));
    const monthsCount = months.size || 1;
    return { total, devs, tools, avgMonthly: total / monthsCount, monthsCount };
  }, [entries]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { dev: number; tool: number; total: number }>();
    for (const e of entries) {
      const k = monthKey(e.competence);
      const cur = map.get(k) || { dev: 0, tool: 0, total: 0 };
      if (e.category === 'developer') cur.dev += e.amount;
      else cur.tool += e.amount;
      cur.total += e.amount;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ key, ...v }));
  }, [entries]);

  // Dados formatados para o gráfico
  const chartData = useMemo(
    () => byMonth.map((m) => ({ key: m.key, month: monthLabel(m.key), dev: m.dev, tool: m.tool, total: m.total })),
    [byMonth]
  );

  const totalByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (!e.item_id) continue;
      map.set(e.item_id, (map.get(e.item_id) || 0) + e.amount);
    }
    return map;
  }, [entries]);

  const entriesByItem = useMemo(() => {
    const periodOrder: Record<FinancePeriod, number> = { full: 0, first_half: 1, second_half: 2 };
    const map = new Map<string, FinanceEntry[]>();
    for (const e of entries) {
      if (!e.item_id) continue;
      const arr = map.get(e.item_id) || [];
      arr.push(e);
      map.set(e.item_id, arr);
    }
    // ordena por competência e, no mesmo mês, 1ª antes da 2ª quinzena
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          a.competence.localeCompare(b.competence) || periodOrder[a.period] - periodOrder[b.period]
      );
    }
    return map;
  }, [entries]);

  const flaggedCount = useMemo(() => entries.filter((e) => e.flagged).length, [entries]);

  // Detalhe dos gastos de um mês específico (agrupado por categoria/item)
  const monthDetail = useMemo(() => {
    if (!selectedMonth) return null;
    const monthEntries = entries.filter((e) => monthKey(e.competence) === selectedMonth);

    const group = (cat: FinanceCategory) => {
      const byItem = new Map<string, { name: string; amount: number; flagged: boolean }>();
      for (const e of monthEntries) {
        if (e.category !== cat) continue;
        const key = e.item_id || e.name;
        const cur = byItem.get(key) || { name: e.name, amount: 0, flagged: false };
        cur.amount += e.amount;
        cur.flagged = cur.flagged || e.flagged;
        byItem.set(key, cur);
      }
      const rows = Array.from(byItem.values()).sort((a, b) => b.amount - a.amount);
      const total = rows.reduce((s, r) => s + r.amount, 0);
      return { rows, total };
    };

    const dev = group('developer');
    const tool = group('tool');
    return { dev, tool, total: dev.total + tool.total };
  }, [selectedMonth, entries]);

  const totalRevenue = useMemo(() => revenues.reduce((s, r) => s + r.amount, 0), [revenues]);

  const developers = items.filter((i) => i.category === 'developer');
  const tools = items.filter((i) => i.category === 'tool');

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-white/70 font-medium max-w-md">{error}</p>
        <p className="text-white/40 text-sm">
          Verifique se as migrations <code className="text-primary">0007_finance.sql</code> e{' '}
          <code className="text-primary">0008_finance_seed.sql</code> foram aplicadas.
        </p>
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
            Gestão Financeira
          </Badge>
          <h1 className="text-5xl font-black tracking-tight text-white italic">Financeiro</h1>
          <p className="text-muted-foreground text-xl max-w-xl">
            Custos com desenvolvedores e ferramentas, recorrências, vencimentos e fonte de cobrança.
          </p>
        </div>
        <div className="flex items-center gap-3 text-white/70">
          <Wallet className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold">{stats.monthsCount} meses registrados</span>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={CircleDollarSign} label="Total do período" value={fmtUSD(stats.total)} />
        <StatCard icon={TrendingUp} label="Média mensal" value={fmtUSD(stats.avgMonthly)} />
        <StatCard icon={Code2} label="Desenvolvedores" value={fmtUSD(stats.devs)} accent />
        <StatCard icon={Wrench} label="Ferramentas" value={fmtUSD(stats.tools)} accent />
      </section>

      {flaggedCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-200/90 text-sm font-medium">
            {flaggedCount} lançamento{flaggedCount === 1 ? '' : 's'} marcado{flaggedCount === 1 ? '' : 's'} como atípico — verifique os itens destacados abaixo.
          </p>
        </div>
      )}

      {/* Despesas mensais */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white tracking-tight">Despesas mensais</h2>
          {byMonth.length > 0 && (
            <span className="text-xs text-white/40">Clique num mês para ver o detalhe</span>
          )}
        </div>
        {byMonth.length === 0 ? (
          <p className="text-white/40 text-sm py-6">Nenhum lançamento ainda.</p>
        ) : (
          <div className="p-5 rounded-2xl border border-white/5 bg-[#1d2125]">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                onClick={(state: any) => {
                  const key = state?.activePayload?.[0]?.payload?.key;
                  if (key) setSelectedMonth((prev) => (prev === key ? null : key));
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  width={48}
                />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-xs text-white/60">{value}</span>
                  )}
                />
                <Bar dataKey="dev" stackId="a" name="Desenvolvedores" fill="#8334ff" radius={[0, 0, 0, 0]} className="cursor-pointer" />
                <Bar dataKey="tool" stackId="a" name="Ferramentas" fill="#34d399" radius={[6, 6, 0, 0]} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Detalhe do mês selecionado */}
        {monthDetail && selectedMonth && (
          <div className="rounded-2xl border border-primary/20 bg-[#1d2125] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-primary/5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Detalhe do mês</p>
                <h3 className="text-2xl font-black text-white">{monthLabel(selectedMonth)}</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-white/40 uppercase tracking-wider">Total</p>
                  <p className="text-xl font-black text-white tabular-nums">{fmtUSD(monthDetail.total)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMonth(null)}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
              <MonthDetailColumn
                title="Desenvolvedores"
                icon={Code2}
                rows={monthDetail.dev.rows}
                total={monthDetail.dev.total}
              />
              <MonthDetailColumn
                title="Ferramentas"
                icon={Wrench}
                rows={monthDetail.tool.rows}
                total={monthDetail.tool.total}
              />
            </div>
          </div>
        )}
      </section>

      {/* Abas: Desenvolvedores / Ferramentas / Receitas */}
      <Tabs defaultValue="developers" className="space-y-8">
        <TabsList className="bg-[#1d2125] border border-white/5 p-1 rounded-2xl h-auto flex-wrap">
          <TabsTrigger
            value="developers"
            className="data-[state=active]:bg-primary/15 data-[state=active]:text-white data-[state=active]:border-primary/30 border border-transparent rounded-xl px-5 py-2.5 font-bold text-muted-foreground gap-2"
          >
            <Code2 className="w-4 h-4" />
            Desenvolvedores
            <span className="text-xs text-white/40">({developers.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="tools"
            className="data-[state=active]:bg-primary/15 data-[state=active]:text-white data-[state=active]:border-primary/30 border border-transparent rounded-xl px-5 py-2.5 font-bold text-muted-foreground gap-2"
          >
            <Wrench className="w-4 h-4" />
            Ferramentas
            <span className="text-xs text-white/40">({tools.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="revenues"
            className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-white data-[state=active]:border-emerald-500/30 border border-transparent rounded-xl px-5 py-2.5 font-bold text-muted-foreground gap-2"
          >
            <Receipt className="w-4 h-4" />
            Receitas
            <span className="text-xs text-white/40">({revenues.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Desenvolvedores */}
        <TabsContent value="developers" className="mt-0">
          <ItemSection
            title="Desenvolvedores"
            icon={Code2}
            items={developers}
            totalByItem={totalByItem}
            entriesByItem={entriesByItem}
            expanded={expanded}
            onToggle={toggle}
            onAdd={() => setItemModal({ open: true, category: 'developer', item: null })}
            onEdit={(item) => setItemModal({ open: true, category: item.category, item })}
            onDelete={deleteItem}
            onToggleActive={toggleActive}
            onAddEntry={(item) => setEntryModal({ open: true, item })}
          />
        </TabsContent>

        {/* Ferramentas */}
        <TabsContent value="tools" className="mt-0">
          <ItemSection
            title="Ferramentas & Infraestrutura"
            icon={Wrench}
            items={tools}
            totalByItem={totalByItem}
            entriesByItem={entriesByItem}
            expanded={expanded}
            onToggle={toggle}
            onAdd={() => setItemModal({ open: true, category: 'tool', item: null })}
            onEdit={(item) => setItemModal({ open: true, category: item.category, item })}
            onDelete={deleteItem}
            onToggleActive={toggleActive}
            onAddEntry={(item) => setEntryModal({ open: true, item })}
          />
        </TabsContent>

        {/* Receitas */}
        <TabsContent value="revenues" className="mt-0">
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-3 text-2xl font-black text-white tracking-tight">
                <Receipt className="w-6 h-6 text-emerald-400" />
                Receitas
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-emerald-400 tabular-nums">{fmtUSD(totalRevenue)}</span>
                <Button size="sm" onClick={() => setRevenueModal({ open: true, revenue: null })}>
                  <Plus className="w-4 h-4 mr-1.5" /> Nova receita
                </Button>
              </div>
            </div>

            {revenues.length === 0 ? (
              <p className="text-white/40 text-sm py-6">Nenhuma receita registrada.</p>
            ) : (
              <div className="space-y-2">
                {revenues.map((rev) => (
                  <div
                    key={rev.id}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-white/5 bg-[#1d2125]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-bold truncate">{rev.source}</h3>
                        {rev.received ? (
                          <Badge variant="tech" className="text-[10px] bg-emerald-500/15 border-emerald-500/40 text-emerald-300">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Recebido
                          </Badge>
                        ) : (
                          <Badge variant="tech" className="text-[10px] bg-white/5 border-white/10 text-white/50">
                            <Clock className="w-3 h-3 mr-1" /> Previsto
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{monthLabel(monthKey(rev.competence))}</span>
                        {rev.description && <span className="truncate">· {rev.description}</span>}
                      </div>
                    </div>
                    <span className="text-base font-black text-white tabular-nums shrink-0">{fmtUSD(rev.amount)}</span>
                    <button
                      type="button"
                      onClick={() => setRevenueModal({ open: true, revenue: rev })}
                      className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRevenue(rev)}
                      className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <FinanceItemModal
        open={itemModal.open}
        category={itemModal.category}
        item={itemModal.item}
        onClose={() => setItemModal((s) => ({ ...s, open: false }))}
        onSaved={fetchData}
      />
      <FinanceEntryModal
        open={entryModal.open}
        item={entryModal.item}
        onClose={() => setEntryModal((s) => ({ ...s, open: false }))}
        onSaved={fetchData}
      />
      <FinanceRevenueModal
        open={revenueModal.open}
        revenue={revenueModal.revenue}
        onClose={() => setRevenueModal((s) => ({ ...s, open: false }))}
        onSaved={fetchData}
      />
    </div>
  );
};

// ── Sub-componentes ──

const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const dev = payload.find((p: any) => p.dataKey === 'dev')?.value ?? 0;
  const tool = payload.find((p: any) => p.dataKey === 'tool')?.value ?? 0;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c0d10] px-4 py-3 shadow-xl">
      <p className="text-sm font-black text-white mb-2">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-white/60">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Desenvolvedores
          </span>
          <span className="font-bold text-white tabular-nums">{fmtUSD(dev)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-white/60">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Ferramentas
          </span>
          <span className="font-bold text-white tabular-nums">{fmtUSD(tool)}</span>
        </div>
        <div className="flex items-center justify-between gap-6 pt-1.5 mt-1.5 border-t border-white/10">
          <span className="text-white/80 font-bold">Total</span>
          <span className="font-black text-white tabular-nums">{fmtUSD(dev + tool)}</span>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
}> = ({ icon: Icon, label, value, accent }) => (
  <div className="p-6 rounded-2xl border border-white/5 bg-[#1d2125] relative overflow-hidden">
    <div className="flex items-center justify-between mb-4">
      <span className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</span>
      <Icon className={`w-5 h-5 ${accent ? 'text-emerald-400' : 'text-primary'}`} />
    </div>
    <p className="text-3xl font-black text-white tabular-nums">{value}</p>
  </div>
);

const MonthDetailColumn: React.FC<{
  title: string;
  icon: React.ElementType;
  rows: { name: string; amount: number; flagged: boolean }[];
  total: number;
}> = ({ title, icon: Icon, rows, total }) => (
  <div className="p-5">
    <div className="flex items-center justify-between mb-3">
      <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white/70">
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </h4>
      <span className="text-sm font-black text-white tabular-nums">{fmtUSD(total)}</span>
    </div>
    {rows.length === 0 ? (
      <p className="text-sm text-white/30 py-2">Nenhum gasto neste mês.</p>
    ) : (
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.name}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
              r.flagged ? 'bg-amber-500/10 border border-amber-500/30' : 'hover:bg-white/[0.03]'
            }`}
          >
            <span className="text-white/70 flex items-center gap-1.5 truncate">
              {r.flagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              {r.name}
            </span>
            <span className="font-bold text-white tabular-nums shrink-0">{fmtUSD(r.amount)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ItemSection: React.FC<{
  title: string;
  icon: React.ElementType;
  items: FinanceItem[];
  totalByItem: Map<string, number>;
  entriesByItem: Map<string, FinanceEntry[]>;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onEdit: (item: FinanceItem) => void;
  onDelete: (item: FinanceItem) => void;
  onToggleActive: (item: FinanceItem) => void;
  onAddEntry: (item: FinanceItem) => void;
}> = ({ title, icon: Icon, items, totalByItem, entriesByItem, expanded, onToggle, onAdd, onEdit, onDelete, onToggleActive, onAddEntry }) => {
  const sectionTotal = items.reduce((s, i) => s + (totalByItem.get(i.id) || 0), 0);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-2xl font-black text-white tracking-tight">
          <Icon className="w-6 h-6 text-primary" />
          {title}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-white/80 tabular-nums">{fmtUSD(sectionTotal)}</span>
          <Button size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-white/40 text-sm py-6">Nenhum item cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isOpen = expanded[item.id];
            const itemEntries = entriesByItem.get(item.id) || [];
            const hasFlag = itemEntries.some((e) => e.flagged);
            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-[#1d2125] overflow-hidden transition-opacity ${
                  hasFlag ? 'border-amber-500/30' : 'border-white/5'
                } ${item.active ? '' : 'opacity-60'}`}
              >
                <div className="flex items-center gap-2 p-5">
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className="flex-1 flex items-center gap-4 text-left min-w-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold truncate ${item.active ? 'text-white' : 'text-white/50'}`}>
                          {item.name}
                        </h3>
                        {item.active ? (
                          <Badge variant="tech" className="text-[10px] bg-emerald-500/15 border-emerald-500/40 text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="tech" className="text-[10px] bg-white/5 border-white/10 text-white/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/40 mr-1.5" /> Inativo
                          </Badge>
                        )}
                        {hasFlag && (
                          <Badge variant="tech" className="text-[10px] bg-amber-500/15 border-amber-500/40 text-amber-300">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Atípico
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5 text-primary" />
                          {RECURRENCE_LABEL[item.recurrence]}
                          {item.due_day ? ` · vence dia ${item.due_day}` : ''}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-primary" />
                          {item.billing_source || 'Cobrança não informada'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs text-white/40 uppercase tracking-wider">Total</p>
                      <p className="text-base font-black text-white tabular-nums">
                        {fmtUSD(totalByItem.get(item.id) || 0)}
                      </p>
                    </div>

                    {isOpen ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0 border-l border-white/5 pl-2">
                    <button
                      type="button"
                      onClick={() => onToggleActive(item)}
                      className={`p-2 rounded-lg transition-colors ${
                        item.active
                          ? 'text-emerald-400 hover:bg-emerald-500/10'
                          : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                      title={item.active ? 'Desativar (parar de contar na projeção)' : 'Ativar'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddEntry(item)}
                      className="p-2 rounded-lg text-white/50 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Lançar despesa"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/5">
                    {item.notes && <p className="text-sm text-white/50 mt-4">{item.notes}</p>}
                    {itemEntries.length === 0 ? (
                      <p className="text-sm text-white/40 mt-4">Nenhum lançamento. Use o botão + para lançar uma despesa.</p>
                    ) : (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {itemEntries.map((e) => (
                          <div
                            key={e.id}
                            className={`px-3 py-2 rounded-xl text-sm ${
                              e.flagged
                                ? 'bg-amber-500/10 border border-amber-500/30'
                                : 'bg-white/[0.03] border border-white/5'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white/50">{monthLabel(monthKey(e.competence))}</span>
                              <span className="font-bold text-white tabular-nums">{fmtUSD(e.amount)}</span>
                            </div>
                            {e.period !== 'full' && (
                              <span className="text-[10px] text-primary/70 font-semibold">
                                {PERIOD_LABEL[e.period]}
                                {e.pay_day ? ` · dia ${e.pay_day}` : ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default FinanceManagement;
