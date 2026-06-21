import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  ArrowLeft, Loader2, Search, ScrollText, RefreshCw, X, ChevronDown,
  // ícones de eventos
  PlusSquare, Pencil, Type, Trash2, ArrowRightLeft, CheckCircle2, RotateCcw,
  UserPlus, UserMinus, Archive, ArchiveRestore, MessageSquare, MessageSquareX,
  Paperclip, FileX, Columns3, Settings2, Activity, Filter, Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../../components/jobs/ui/badge';
import {
  ActivityLogRow, getActivityMeta, ACTIVITY_FILTER_GROUPS, ActivityEntityType,
} from '../../lib/activityLog';

const ICONS: Record<string, React.ElementType> = {
  PlusSquare, Pencil, Type, Trash2, ArrowRightLeft, CheckCircle2, RotateCcw,
  UserPlus, UserMinus, Archive, ArchiveRestore, MessageSquare, MessageSquareX,
  Paperclip, FileX, Columns3, Settings2, Activity,
};

const PAGE_SIZE = 50;

type DateFilter = 'all' | 'today' | '7d' | '30d';

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
];

function fullDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Hoje';
  if (sameDay(d, yesterday)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
const AVATAR_COLORS = ['#6d28d9', '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function describe(row: ActivityLogRow): string {
  const m = (row.metadata ?? {}) as Record<string, any>;
  switch (`${row.entity_type}:${row.action}`) {
    case 'card:moved':
      return m.from_column && m.to_column ? `de "${m.from_column}" para "${m.to_column}"` : '';
    case 'card:renamed':
    case 'column:renamed':
    case 'board:renamed':
      return m.from && m.to ? `"${m.from}" → "${m.to}"` : '';
    case 'card:updated':
      return Array.isArray(m.fields) ? `campos: ${m.fields.join(', ')}` : '';
    case 'comment:commented':
      return m.excerpt ? `"${m.excerpt}"` : '';
    case 'attachment:uploaded':
    case 'attachment:attachment_deleted':
      return m.card ? `no card "${m.card}"` : '';
    default:
      return '';
  }
}

const ProjectLogs: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();

  const [boardTitle, setBoardTitle] = useState<string>('');
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filtros
  const [search, setSearch] = useState('');
  const [entityFilters, setEntityFilters] = useState<Set<ActivityEntityType>>(new Set());
  const [actorFilter, setActorFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const dateThreshold = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString(); }
    if (dateFilter === '7d') { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
    if (dateFilter === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString(); }
    return null;
  }, [dateFilter]);

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    if (!boardId) return;
    let query = supabase
      .from('activity_log')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (entityFilters.size > 0) query = query.in('entity_type', Array.from(entityFilters));
    if (actorFilter) query = query.eq('actor_id', actorFilter);
    if (dateThreshold) query = query.gte('created_at', dateThreshold);

    const { data, error } = await query;
    if (error) { console.error('Erro ao carregar logs:', error.message); return; }
    const page = (data ?? []) as ActivityLogRow[];
    setHasMore(page.length === PAGE_SIZE);
    setRows(prev => (replace ? page : [...prev, ...page]));
  }, [boardId, entityFilters, actorFilter, dateThreshold]);

  // Título do board
  useEffect(() => {
    if (!boardId) return;
    supabase.from('boards').select('title').eq('id', boardId).single()
      .then(({ data }) => { if (data) setBoardTitle(data.title); });
  }, [boardId]);

  // Carga inicial / refetch ao mudar filtros do servidor
  useEffect(() => {
    setLoading(true);
    fetchPage(0, true).finally(() => setLoading(false));
  }, [fetchPage]);

  // Realtime: novos eventos entram no topo
  useEffect(() => {
    if (!boardId) return;
    const channel = supabase
      .channel(`activity-log-${boardId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `board_id=eq.${boardId}` },
        (payload) => {
          const row = payload.new as ActivityLogRow;
          setRows(prev => (prev.some(r => r.id === row.id) ? prev : [row, ...prev]));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [boardId]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchPage(rows.length, false);
    setLoadingMore(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchPage(0, true);
    setLoading(false);
  };

  // Lista de atores presentes (para o filtro)
  const actors = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => { if (r.actor_id) map.set(r.actor_id, r.actor_name || 'Usuário'); });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows]);

  // Filtro de busca textual (client-side, sobre a página já carregada)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const meta = getActivityMeta(r);
      return (
        (r.entity_label ?? '').toLowerCase().includes(q) ||
        (r.actor_name ?? '').toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q) ||
        describe(r).toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  // Agrupamento por dia
  const grouped = useMemo(() => {
    const groups: { label: string; items: ActivityLogRow[] }[] = [];
    filtered.forEach(r => {
      const label = dayLabel(r.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(r);
      else groups.push({ label, items: [r] });
    });
    return groups;
  }, [filtered]);

  const toggleEntity = (e: ActivityEntityType) => {
    setEntityFilters(prev => {
      const next = new Set(prev);
      next.has(e) ? next.delete(e) : next.add(e);
      return next;
    });
  };

  const clearFilters = () => {
    setEntityFilters(new Set());
    setActorFilter('');
    setDateFilter('all');
    setSearch('');
  };

  const hasActiveFilters = entityFilters.size > 0 || !!actorFilter || dateFilter !== 'all' || !!search.trim();

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div className="flex flex-col gap-6 pb-8 border-b border-white/5">
        <button
          onClick={() => navigate('/admin/boards')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Projetos
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <Badge variant="tech" className="px-4 py-1.5 bg-primary/20 border-primary/40 text-primary font-black uppercase tracking-widest text-[10px]">
              Histórico de Atividade
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white italic flex items-center gap-3">
              <ScrollText className="w-9 h-9 text-primary not-italic" />
              Logs do Projeto
            </h1>
            <p className="text-muted-foreground text-lg">
              {boardTitle ? <>Projeto: <span className="text-white font-semibold">{boardTitle}</span></> : 'Carregando projeto…'}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-semibold transition-colors border border-white/10 w-fit"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </div>

      {/* Barra de busca + filtros */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por card, autor, ação…"
              className="w-full bg-[#1d2125] border border-white/10 rounded-xl pl-11 pr-10 py-3 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors border ${
              showFilters || entityFilters.size > 0 || actorFilter || dateFilter !== 'all'
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-[#1d2125] border-white/10 text-white/80 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" /> Filtros
            {(entityFilters.size > 0 || actorFilter || dateFilter !== 'all') && (
              <span className="bg-primary text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
                {entityFilters.size + (actorFilter ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0)}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#1d2125] border border-white/10 rounded-2xl p-5 space-y-5">
                {/* Tipo de evento */}
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Tipo de evento</span>
                  <div className="flex flex-wrap gap-2">
                    {ACTIVITY_FILTER_GROUPS.map(g => {
                      const active = entityFilters.has(g.entityType);
                      return (
                        <button
                          key={g.entityType}
                          onClick={() => toggleEntity(g.entityType)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                            active ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                          }`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Período */}
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Período
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {DATE_FILTERS.map(d => (
                      <button
                        key={d.key}
                        onClick={() => setDateFilter(d.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                          dateFilter === d.key ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Autor */}
                {actors.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Autor</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setActorFilter('')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                          !actorFilter ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        Todos
                      </button>
                      {actors.map(a => (
                        <button
                          key={a.id}
                          onClick={() => setActorFilter(a.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                            actorFilter === a.id ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                          }`}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> Limpar filtros
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <ScrollText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-white font-bold text-lg">Nenhum log encontrado</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {hasActiveFilters
              ? 'Nenhuma atividade corresponde aos filtros selecionados.'
              : 'Ainda não há atividade registrada neste projeto. As ações aparecerão aqui automaticamente.'}
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-2 text-sm font-semibold text-primary hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <div key={group.label} className="space-y-3">
              <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#050505]/80 backdrop-blur-sm">
                <span className="text-xs uppercase tracking-wider font-black text-white/70 capitalize">
                  {group.label}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{group.items.length} evento{group.items.length > 1 ? 's' : ''}</span>
              </div>

              <div className="relative pl-2">
                {/* linha vertical da timeline */}
                <div className="absolute left-[1.35rem] top-2 bottom-2 w-px bg-white/10" />
                <div className="space-y-2">
                  {group.items.map(row => {
                    const meta = getActivityMeta(row);
                    const Icon = ICONS[meta.icon] ?? Activity;
                    const desc = describe(row);
                    const isExpanded = expanded.has(row.id);
                    const hasMeta = row.metadata && Object.keys(row.metadata).length > 0;
                    return (
                      <div key={row.id} className="relative flex gap-4 group">
                        {/* nó da timeline */}
                        <div className={`relative z-10 mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-[#1d2125] border border-white/10 flex items-center justify-center ${meta.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0 bg-[#1d2125] border border-white/5 rounded-xl px-4 py-3 hover:border-white/10 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-white leading-snug">
                                <span className="font-semibold">{row.actor_name || 'Usuário'}</span>{' '}
                                <span className="text-white/70">{meta.label.toLowerCase()}</span>
                                {row.entity_label && (
                                  <> <span className="font-medium text-white">"{row.entity_label}"</span></>
                                )}
                              </p>
                              {desc && <p className="text-xs text-muted-foreground mt-1 truncate">{desc}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap" title={fullDateTime(row.created_at)}>
                                {timeOnly(row.created_at)}
                              </span>
                              {hasMeta && (
                                <button
                                  onClick={() => setExpanded(prev => {
                                    const next = new Set(prev);
                                    next.has(row.id) ? next.delete(row.id) : next.add(row.id);
                                    return next;
                                  })}
                                  className="text-muted-foreground hover:text-white transition-colors"
                                  title="Detalhes"
                                >
                                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              )}
                            </div>
                          </div>

                          <AnimatePresence initial={false}>
                            {isExpanded && hasMeta && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-4 flex-wrap text-[11px]">
                                  <span className="text-muted-foreground">{fullDateTime(row.created_at)}</span>
                                  {/* avatar do autor */}
                                  {row.actor_name && (
                                    <span className="flex items-center gap-1.5 text-white/80">
                                      <span
                                        className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                                        style={{ backgroundColor: avatarColor(row.actor_id || row.actor_name) }}
                                      >
                                        {initials(row.actor_name)}
                                      </span>
                                      {row.actor_name}
                                    </span>
                                  )}
                                </div>
                                <pre className="mt-2 text-[11px] text-white/60 bg-black/30 rounded-lg p-3 overflow-x-auto custom-scrollbar">
                                  {JSON.stringify(row.metadata, null, 2)}
                                </pre>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Carregar mais */}
          {hasMore && !search.trim() && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-semibold transition-colors border border-white/10 disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectLogs;
