import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useBoardBackground } from '../../context/BoardBackgroundContext';
import {
  ArrowLeft, Trash2, Plus, Loader2, X, Check,
  CheckSquare, Calendar, AlignLeft, Search,
  MoreHorizontal, SortAsc, SortDesc, Paintbrush
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CardModal, { Task, Column, MemberInfo, initials, avatarColor } from '../../components/user/CardModal';

// ────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────

interface Board { id: string; title: string; background: string; bg_type: 'gradient' | 'image'; owner_id: string; }

// ────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────



const BOARD_GRADIENTS = [
  { name: 'Roxo Suaiden',   value: 'linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)' },
  { name: 'Oceano',         value: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)' },
  { name: 'Esmeralda',      value: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { name: 'Pôr do Sol',     value: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { name: 'Rubi',           value: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
  { name: 'Carvão',         value: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' },
  { name: 'Aurora',         value: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)' },
  { name: 'Flamingo',       value: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' },
  { name: 'Meia-noite',     value: 'linear-gradient(135deg, #0f0f1a 0%, #1e1b4b 100%)' },
  { name: 'Selva',          value: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' },
  { name: 'Cobre',          value: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)' },
  { name: 'Neon',           value: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 50%, #10b981 100%)' },
];

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function formatDueDate(dateStr: string | null): { text: string; status: 'overdue' | 'soon' | 'ok' } | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  const text = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  if (diff < 0) return { text, status: 'overdue' };
  if (days <= 2) return { text, status: 'soon' };
  return { text, status: 'ok' };
}

// ────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────

const KanbanPage: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { setBoardBackground, clearBoardBackground } = useBoardBackground();

  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);

  // Edição de colunas
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState('');
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});
  const [activeAddCardColId, setActiveAddCardColId] = useState<string | null>(null);

  // Menu "..." das colunas
  const [openColMenuId, setOpenColMenuId] = useState<string | null>(null);
  const [confirmClearColId, setConfirmClearColId] = useState<string | null>(null);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Painel de background
  const [isBackgroundPanelOpen, setIsBackgroundPanelOpen] = useState(false);
  const bgPanelRef = useRef<HTMLDivElement>(null);

  // Modal do card
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeTaskColId, setActiveTaskColId] = useState<string | null>(null);

  // Membros do quadro
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [allSystemUsers, setAllSystemUsers] = useState<{ id: string; full_name: string; email: string; }[]>([]);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const membersRef = useRef<HTMLDivElement>(null);

  // Filtros
  const [searchText, setSearchText] = useState('');
  const [filterLabelColor, setFilterLabelColor] = useState<string | null>(null);
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null);

  // ────────────────────────────────────────────
  // Dados
  // ────────────────────────────────────────────

  const mapTask = (t: any): Task => ({
    ...t,
    checklist: Array.isArray(t.checklist) ? t.checklist : [],
    labels: Array.isArray(t.labels) ? t.labels : [],
    assignees: Array.isArray(t.assignees) ? t.assignees : [],
    due_date: t.due_date || null,
    cover_color: t.cover_color || null,
    is_done: !!t.is_done,
  });

  const fetchBoardData = async () => {
    if (!boardId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (profile) setCurrentUserRole(profile.role);
      }

      const { data: boardData, error: boardError } = await supabase
        .from('boards').select('id, title, background, bg_type, owner_id').eq('id', boardId).single();
      if (boardError) throw boardError;
      setBoard(boardData);
      setBoardBackground({ bg_type: boardData.bg_type, background: boardData.background });

      const { data: membersData } = await supabase
        .from('board_members').select('user_id, profiles:user_id (full_name, email)').eq('board_id', boardId);
      const { data: ownerProfile } = await supabase
        .from('profiles').select('id, full_name, email').eq('id', boardData.owner_id).single();

      const formattedMembers: MemberInfo[] = [];
      if (ownerProfile) formattedMembers.push({ user_id: ownerProfile.id, full_name: `${ownerProfile.full_name} (Dono)`, email: ownerProfile.email });
      if (membersData) {
        membersData.forEach((m: any) => {
          if (m.user_id !== boardData.owner_id && m.profiles)
            formattedMembers.push({ user_id: m.user_id, full_name: m.profiles.full_name, email: m.profiles.email });
        });
      }
      setMembers(formattedMembers);

      const { data: colsData, error: colsError } = await supabase
        .from('columns').select('*').eq('board_id', boardId).order('position', { ascending: true });
      if (colsError) throw colsError;

      if (colsData.length > 0) {
        const colIds = colsData.map(c => c.id);
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks').select('*').in('column_id', colIds).order('position', { ascending: true });
        if (tasksError) throw tasksError;

        setColumns(colsData.map(col => ({
          ...col,
          tasks: (tasksData || []).map(mapTask).filter(t => t.column_id === col.id)
        })));

        if (activeTask) {
          const fresh = (tasksData || []).find(t => t.id === activeTask.id);
          if (fresh) setActiveTask(mapTask(fresh));
        }
      } else {
        setColumns([]);
      }
    } catch (err) {
      console.error('Erro ao carregar Kanban:', err);
    } finally {
      setLoading(false);
    }
  };
  const fetchBoardDataRef = useRef(fetchBoardData);
  useEffect(() => {
    fetchBoardDataRef.current = fetchBoardData;
  });

  useEffect(() => {
    fetchBoardData();
    const sub = supabase.channel(`kanban-rt-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` }, () => fetchBoardDataRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchBoardDataRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_members', filter: `board_id=eq.${boardId}` }, () => fetchBoardDataRef.current())
      .subscribe();

    const handleClickOutside = (e: MouseEvent) => {
      if (membersRef.current && !membersRef.current.contains(e.target as Node)) setIsMembersModalOpen(false);
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setOpenColMenuId(null); setConfirmClearColId(null);
      }
      if (bgPanelRef.current && !bgPanelRef.current.contains(e.target as Node)) setIsBackgroundPanelOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { supabase.removeChannel(sub); document.removeEventListener('mousedown', handleClickOutside); clearBoardBackground(); };
  }, [boardId]);

  // Buscar todos os usuários do sistema para adicionar membros
  useEffect(() => {
    if (isMembersModalOpen) {
      const fetchAllUsers = async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .order('full_name', { ascending: true });
          if (data) {
            setAllSystemUsers(data);
          }
        } catch (err) {
          console.error('Erro ao buscar usuários do sistema:', err);
        }
      };
      fetchAllUsers();
    }
  }, [isMembersModalOpen]);

  // ── Alterar Background do Quadro ──
  const handleChangeBoardBackground = async (gradient: string) => {
    if (!boardId) return;
    try {
      await supabase.from('boards').update({ background: gradient, bg_type: 'gradient' }).eq('id', boardId);
      setBoard(prev => prev ? { ...prev, background: gradient, bg_type: 'gradient' } : null);
      setBoardBackground({ bg_type: 'gradient', background: gradient });
    } catch (err) { console.error('Erro ao alterar background:', err); }
  };

  // ── Filtros ──
  const filteredColumns = useMemo(() => {
    const hasFilter = searchText.trim() || filterLabelColor || filterAssigneeId;
    if (!hasFilter) return columns;
    return columns.map(col => ({
      ...col,
      tasks: col.tasks.filter(task => {
        const matchText = !searchText.trim() || task.title.toLowerCase().includes(searchText.toLowerCase());
        const matchLabel = !filterLabelColor || task.labels.some(l => l.color === filterLabelColor);
        const matchAssignee = !filterAssigneeId || task.assignees.some(a => a.user_id === filterAssigneeId);
        return matchText && matchLabel && matchAssignee;
      })
    }));
  }, [columns, searchText, filterLabelColor, filterAssigneeId]);

  const hasActiveFilter = !!(searchText.trim() || filterLabelColor || filterAssigneeId);
  const totalFilteredCards = hasActiveFilter ? filteredColumns.reduce((s, c) => s + c.tasks.length, 0) : null;

  // ── Callbacks do Modal ──
  const handleUpdateTask = async (updates: Partial<Task>) => {
    if (!activeTask) return;
    const { error } = await supabase.from('tasks').update(updates).eq('id', activeTask.id);
    if (error) throw error;
    setActiveTask(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleDeleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId);
    setActiveTask(null);
  };

  const handleMoveTask = async (targetColId: string) => {
    if (!activeTask) return;
    const newPosition = columns.find(c => c.id === targetColId)?.tasks.length || 0;
    const { error } = await supabase.from('tasks').update({ column_id: targetColId, position: newPosition }).eq('id', activeTask.id);
    if (error) throw error;
    setActiveTaskColId(targetColId);
  };

  // ── Colunas ──
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardId || !newColumnTitle.trim()) return;
    try {
      await supabase.from('columns').insert({ board_id: boardId, title: newColumnTitle.trim(), position: columns.length });
      setNewColumnTitle('');
    } catch (err) { console.error(err); }
  };
  const handleSaveColumnTitle = async (colId: string) => {
    if (!editingColumnTitle.trim()) { setEditingColumnId(null); return; }
    try { await supabase.from('columns').update({ title: editingColumnTitle.trim() }).eq('id', colId); setEditingColumnId(null); }
    catch (err) { console.error(err); }
  };
  const handleDeleteColumn = async (columnId: string) => {
    try { await supabase.from('columns').delete().eq('id', columnId); } catch (err) { console.error(err); }
  };

  // ── Menu da Coluna: Ordenar ──
  const handleSortColumn = async (colId: string, mode: 'az' | 'za' | 'due_asc' | 'due_desc') => {
    const col = columns.find(c => c.id === colId);
    if (!col) return;
    const sorted = [...col.tasks].sort((a, b) => {
      if (mode === 'az') return a.title.localeCompare(b.title, 'pt-BR');
      if (mode === 'za') return b.title.localeCompare(a.title, 'pt-BR');
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return mode === 'due_asc' ? ad - bd : bd - ad;
    });
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, tasks: sorted.map((t, i) => ({ ...t, position: i })) } : c));
    try { await Promise.all(sorted.map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id))); }
    catch (err) { console.error(err); }
    setOpenColMenuId(null);
  };

  const handleClearColumn = async (colId: string) => {
    const col = columns.find(c => c.id === colId);
    if (!col?.tasks.length) return;
    try { await Promise.all(col.tasks.map(t => supabase.from('tasks').delete().eq('id', t.id))); }
    catch (err) { console.error(err); }
    setOpenColMenuId(null); setConfirmClearColId(null);
  };

  // ── Cards ──
  const handleAddCard = async (columnId: string) => {
    const title = newCardTitles[columnId];
    if (!title?.trim()) return;
    try {
      const position = columns.find(c => c.id === columnId)?.tasks.length || 0;
      await supabase.from('tasks').insert({
        column_id: columnId, title: title.trim(), position,
        description: '', checklist: [], labels: [], assignees: [], due_date: null, cover_color: null,
        is_done: false
      });
      setNewCardTitles(prev => ({ ...prev, [columnId]: '' }));
    } catch (err) { console.error(err); }
  };

  // ── Membros do quadro ──
  const handleAddMember = async (userId: string) => {
    if (!boardId || currentUserRole !== 'admin') return;
    try {
      const { error } = await supabase
        .from('board_members')
        .insert({ board_id: boardId, user_id: userId });
      if (error) throw error;
      fetchBoardData();
    } catch (err) {
      console.error('Erro ao adicionar membro:', err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!boardId || currentUserRole !== 'admin') return;
    try {
      const { error } = await supabase
        .from('board_members')
        .delete()
        .eq('board_id', boardId)
        .eq('user_id', userId);
      if (error) throw error;
      fetchBoardData();
    } catch (err) {
      console.error('Erro ao remover membro:', err);
    }
  };

  // ── Drag & Drop ──
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedSourceColId, setDraggedSourceColId] = useState<string | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const handleColDragStart = (e: React.DragEvent, colId: string) => { setDraggedColId(colId); e.dataTransfer.effectAllowed = 'move'; };
  const handleColDrop = async (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColId) return;
    const from = columns.findIndex(c => c.id === draggedColId), to = columns.findIndex(c => c.id === targetColId);
    if (from === -1 || to === -1) return;
    const reordered = [...columns];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const final = reordered.map((c, i) => ({ ...c, position: i }));
    setColumns(final);
    try { await Promise.all(final.map(c => supabase.from('columns').update({ position: c.position }).eq('id', c.id))); }
    catch (err) { console.error(err); } finally { setDraggedColId(null); }
  };
  const handleCardDragStart = (e: React.DragEvent, taskId: string, sourceColId: string) => {
    e.stopPropagation(); setDraggedTaskId(taskId); setDraggedSourceColId(sourceColId); e.dataTransfer.effectAllowed = 'move';
  };
  const handleCardDrop = async (e: React.DragEvent, targetColId: string, targetIndex?: number) => {
    e.preventDefault(); e.stopPropagation();
    if (!draggedTaskId || !draggedSourceColId) return;
    try {
      const targetCol = columns.find(c => c.id === targetColId);
      if (!targetCol) return;
      let targetTasks = [...targetCol.tasks];
      let sourceTasks = [...(columns.find(c => c.id === draggedSourceColId)?.tasks || [])];
      const movedTask = sourceTasks.find(t => t.id === draggedTaskId);
      if (!movedTask) return;
      if (draggedSourceColId !== targetColId) sourceTasks = sourceTasks.filter(t => t.id !== draggedTaskId);
      else targetTasks = targetTasks.filter(t => t.id !== draggedTaskId);
      targetTasks.splice(targetIndex ?? targetTasks.length, 0, { ...movedTask, column_id: targetColId });
      await supabase.from('tasks').update({ column_id: targetColId, position: targetIndex ?? targetTasks.length - 1 }).eq('id', draggedTaskId);
      const updatePos = (list: Task[]) => Promise.all(list.map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id)));
      await updatePos(targetTasks);
      if (draggedSourceColId !== targetColId) await updatePos(sourceTasks);
    } catch (err) { console.error(err); } finally { setDraggedTaskId(null); setDraggedSourceColId(null); }
  };

  // Navegação inteligente de volta
  const handleBack = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      if (profile?.role === 'admin') {
        navigate('/admin/boards');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      navigate('/dashboard');
    }
  };

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────

  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 h-full flex flex-col relative overflow-hidden">

      {/* ── Top Bar (Cabeçalho Secundário Compacto) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 shrink-0">
        
        {/* Lado Esquerdo: Título e Voltar */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBack} 
            className="p-1.5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-muted-foreground hover:text-white"
            title="Voltar para a Área de Trabalho"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-white tracking-tight">{board?.title || 'Quadro'}</h1>
        </div>

        {/* Lado Direito: Filtros e Ações em Linha Única */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Buscar cards */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input 
              type="text" 
              placeholder="Buscar cards..." 
              value={searchText} 
              onChange={e => setSearchText(e.target.value)}
              className="pl-8 pr-3 h-8 bg-black/30 border border-white/10 focus:border-primary/50 rounded-xl text-xs text-white placeholder:text-muted-foreground outline-none w-44 focus:w-56 transition-all duration-200" 
            />
          </div>

          {/* Filtro de Membros & Gerenciar */}
          <div className="relative" ref={membersRef}>
            <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-2 py-0.5 h-8">
              <div className="flex items-center -space-x-1.5 shrink-0">
                {members.slice(0, 3).map(m => (
                  <button 
                    key={m.user_id} 
                    onClick={() => setFilterAssigneeId(filterAssigneeId === m.user_id ? null : m.user_id)} 
                    title={m.full_name}
                    className={`w-6 h-6 rounded-full text-[9px] font-bold text-white flex items-center justify-center transition-all border border-black/40 shrink-0 ${filterAssigneeId === m.user_id ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'}`}
                    style={{ backgroundColor: avatarColor(m.user_id) }}
                  >
                    {initials(m.full_name)}
                  </button>
                ))}
                {members.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-white/10 border border-black/40 text-[9px] font-bold text-white flex items-center justify-center shrink-0">
                    +{members.length - 3}
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setIsMembersModalOpen(!isMembersModalOpen)} 
                className="p-0.5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-lg transition-colors shrink-0" 
                title="Adicionar / Ver Membros"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <AnimatePresence>
              {isMembersModalOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }} 
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#0c0c0c] border border-white/10 shadow-2xl p-4 z-40 backdrop-blur-xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-bold text-xs text-white">Membros do Quadro</span>
                    <button onClick={() => { setIsMembersModalOpen(false); setSearchMemberQuery(''); }}>
                      <X className="w-4 h-4 text-muted-foreground hover:text-white" />
                    </button>
                  </div>
                  
                  {/* Membros Ativos */}
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Ativos ({members.length})</span>
                    {members.map(m => (
                      <div key={m.user_id} className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: avatarColor(m.user_id) }}>
                             {initials(m.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{m.full_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                          </div>
                        </div>
                        {currentUserRole === 'admin' && m.user_id !== board?.owner_id && (
                          <button 
                            onClick={() => handleRemoveMember(m.user_id)}
                            className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-lg transition-colors shrink-0"
                            title="Remover membro"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Adicionar Membros (Apenas se for Admin) */}
                  {currentUserRole === 'admin' && (
                    <div className="border-t border-white/5 pt-3 space-y-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Adicionar Usuários</span>
                      
                      {/* Campo de Busca de Usuário */}
                      <input 
                        type="text" 
                        placeholder="Buscar usuário do sistema..." 
                        value={searchMemberQuery}
                        onChange={e => setSearchMemberQuery(e.target.value)}
                        className="w-full bg-[#1e2126] border border-white/5 focus:border-primary/50 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder:text-muted-foreground outline-none" 
                      />

                      {/* Lista de usuários cadastrados que NÃO estão no quadro */}
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {allSystemUsers
                          .filter(u => !members.some(m => m.user_id === u.id))
                          .filter(u => u.full_name.toLowerCase().includes(searchMemberQuery.toLowerCase()) || u.email.toLowerCase().includes(searchMemberQuery.toLowerCase()))
                          .map(user => (
                            <div key={user.id} className="flex items-center justify-between gap-2.5 py-0.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: avatarColor(user.id) }}>
                                  {initials(user.full_name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white truncate">{user.full_name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleAddMember(user.id)}
                                className="px-2 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary hover:text-white rounded-lg text-[10px] font-bold transition-all"
                              >
                                Adicionar
                              </button>
                            </div>
                          ))}
                        {allSystemUsers.filter(u => !members.some(m => m.user_id === u.id)).length === 0 && (
                          <p className="text-[10px] text-muted-foreground italic text-center py-2">Todos os usuários já fazem parte deste quadro.</p>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Editar Background */}
          <div className="relative" ref={bgPanelRef}>
            <button
              onClick={() => setIsBackgroundPanelOpen(!isBackgroundPanelOpen)}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/10 transition-all h-8"
            >
              <Paintbrush className="w-4 h-4 text-muted-foreground" />
              <span>Fundo</span>
            </button>

            <AnimatePresence>
              {isBackgroundPanelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0c0c0c] border border-white/10 shadow-2xl p-4 z-40 backdrop-blur-xl space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-bold text-xs text-white">Escolher Fundo do Quadro</span>
                    <button onClick={() => setIsBackgroundPanelOpen(false)}>
                      <X className="w-4 h-4 text-muted-foreground hover:text-white" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {BOARD_GRADIENTS.map(g => (
                      <button
                        key={g.value}
                        onClick={() => handleChangeBoardBackground(g.value)}
                        title={g.name}
                        className={`relative h-14 rounded-xl overflow-hidden transition-all hover:scale-105 ${board?.background === g.value ? 'ring-2 ring-white scale-105' : 'ring-1 ring-white/10'}`}
                        style={{ background: g.value }}
                      >
                        {board?.background === g.value && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white drop-shadow-lg" />
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 text-[8px] font-bold text-white/90 text-center pb-1 bg-black/30 truncate px-1">{g.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Limpar filtros */}
          {hasActiveFilter && (
            <button 
              onClick={() => { setSearchText(''); setFilterLabelColor(null); setFilterAssigneeId(null); }}
              className="flex items-center justify-center w-8 h-8 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all"
              title="Limpar todos os filtros"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {totalFilteredCards !== null && (
            <span className="text-[10px] text-muted-foreground font-semibold bg-white/5 px-2.5 py-1 rounded-xl border border-white/5 h-8 flex items-center">
              {totalFilteredCards} card{totalFilteredCards !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Colunas ── */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start select-none overflow-y-hidden custom-scrollbar">
        {filteredColumns.map(column => (
          <div key={column.id} draggable
            onDragStart={e => handleColDragStart(e, column.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { if (draggedColId) handleColDrop(e, column.id); else if (draggedTaskId) handleCardDrop(e, column.id); }}
            className="w-72 shrink-0 bg-[#101214] border border-white/5 rounded-2xl flex flex-col max-h-full shadow-xl">

            {/* Header da coluna */}
            <div className="p-3 flex items-center justify-between border-b border-white/10 cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {editingColumnId === column.id ? (
                  <input autoFocus value={editingColumnTitle} onChange={e => setEditingColumnTitle(e.target.value)}
                    onBlur={() => handleSaveColumnTitle(column.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveColumnTitle(column.id); if (e.key === 'Escape') setEditingColumnId(null); }}
                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-2 py-0.5 text-xs text-white outline-none focus:border-primary/50 font-bold" />
                ) : (
                  <span onClick={() => { setEditingColumnId(column.id); setEditingColumnTitle(column.title); }}
                    className="font-bold text-white text-sm cursor-pointer hover:underline truncate" title="Clique para renomear">
                    {column.title}
                  </span>
                )}
                <span className="shrink-0 text-[10px] font-bold bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full">{column.tasks.length}</span>
              </div>

              {/* Menu "..." da coluna */}
              <div className="relative" ref={openColMenuId === column.id ? colMenuRef : undefined}>
                <button onClick={e => { e.stopPropagation(); setOpenColMenuId(openColMenuId === column.id ? null : column.id); setConfirmClearColId(null); }}
                  className="ml-1 p-1 hover:bg-white/10 text-muted-foreground hover:text-white rounded-lg transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {openColMenuId === column.id && (
                    <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      className="absolute right-0 mt-1 w-52 rounded-2xl bg-[#0c0c0c] border border-white/10 shadow-2xl z-30 overflow-hidden">
                      <div className="p-2 space-y-0.5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1">Ordenar lista</p>
                        <button onClick={() => handleSortColumn(column.id, 'az')} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                          <SortAsc className="w-3.5 h-3.5 text-muted-foreground" /> A → Z (título)
                        </button>
                        <button onClick={() => handleSortColumn(column.id, 'za')} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                          <SortDesc className="w-3.5 h-3.5 text-muted-foreground" /> Z → A (título)
                        </button>
                        <button onClick={() => handleSortColumn(column.id, 'due_asc')} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Vence mais cedo
                        </button>
                        <button onClick={() => handleSortColumn(column.id, 'due_desc')} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Vence mais tarde
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        <button onClick={() => { handleDeleteColumn(column.id); setOpenColMenuId(null); }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-left">
                          <Trash2 className="w-3.5 h-3.5" /> Excluir lista
                        </button>
                        <div className="h-px bg-white/5 my-0.5" />
                        {confirmClearColId === column.id ? (
                          <div className="px-2 py-1.5 space-y-2">
                            <p className="text-[10px] text-red-400 font-semibold">Remover todos os {column.tasks.length} card(s). Confirma?</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleClearColumn(column.id)} className="flex-1 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-[10px] font-bold">Sim, limpar</button>
                              <button onClick={() => setConfirmClearColId(null)} className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-bold">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmClearColId(column.id)} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-left">
                            <Trash2 className="w-3.5 h-3.5" /> Limpar todos os cards
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2.5 space-y-2 overflow-y-auto min-h-[120px]">
              {column.tasks.map((task, index) => {
                const dueDateInfo = formatDueDate(task.due_date);
                return (
                  <div key={task.id} draggable
                    onDragStart={e => handleCardDragStart(e, task.id, column.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleCardDrop(e, column.id, index)}
                    onClick={() => { setActiveTask(task); setActiveTaskColId(column.id); }}
                    className="bg-[#22252a] hover:bg-[#2b2e35] border border-white/5 hover:border-white/10 rounded-2xl cursor-grab active:cursor-grabbing shadow transition-all duration-200 group overflow-hidden flex flex-col">
                    {task.cover_color && <div className="h-8 w-full shrink-0" style={{ backgroundColor: task.cover_color }} />}
                    <div className="p-3 flex flex-col gap-2">
                      {task.labels?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.labels.map(label => (
                            <span key={label.id} className="text-[9px] font-bold px-2 py-0.5 rounded-full text-black" style={{ backgroundColor: label.color + 'cc' }}>{label.text}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const nextDone = !task.is_done;
                              try {
                                await supabase.from('tasks').update({ is_done: nextDone }).eq('id', task.id);
                                setColumns(prev => prev.map(c => {
                                  if (c.id === column.id) {
                                    return {
                                      ...c,
                                      tasks: c.tasks.map(t => t.id === task.id ? { ...t, is_done: nextDone } : t)
                                    };
                                  }
                                  return c;
                                }));
                              } catch (err) {
                                console.error('Erro ao atualizar status do card:', err);
                              }
                            }}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                              task.is_done
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                : 'bg-transparent border-white/20 hover:border-emerald-500/50'
                            }`}
                            title={task.is_done ? "Marcar como não concluído" : "Marcar como concluído"}
                          >
                            {task.is_done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </button>
                          <span className={`text-sm font-semibold leading-snug transition-all ${
                            task.is_done ? 'line-through text-muted-foreground/60' : 'text-white/90'
                          }`}>
                            {task.title}
                          </span>
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleDeleteTask(task.id); }}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {task.description && <div title="Possui descrição"><AlignLeft className="w-3.5 h-3.5 text-muted-foreground/70" /></div>}
                          {task.checklist?.length > 0 && (
                            <div className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${task.checklist.every(i => i.done) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-muted-foreground'}`}>
                              <CheckSquare className="w-3 h-3" /><span>{task.checklist.filter(i => i.done).length}/{task.checklist.length}</span>
                            </div>
                          )}
                          {dueDateInfo && (
                            <div className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${dueDateInfo.status === 'overdue' ? 'bg-red-500/20 text-red-400' : dueDateInfo.status === 'soon' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-muted-foreground'}`}>
                              <Calendar className="w-3 h-3" /><span>{dueDateInfo.text}</span>
                            </div>
                          )}
                        </div>
                        {task.assignees?.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {task.assignees.slice(0, 3).map(a => (
                              <div key={a.user_id} title={a.full_name}
                                className="w-5 h-5 rounded-full border border-black text-[8px] font-bold text-white flex items-center justify-center"
                                style={{ backgroundColor: avatarColor(a.user_id) }}>
                                {initials(a.full_name)}
                              </div>
                            ))}
                            {task.assignees.length > 3 && (
                              <div className="w-5 h-5 rounded-full border border-black bg-white/10 text-[8px] font-bold text-white flex items-center justify-center">+{task.assignees.length - 3}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {column.tasks.length === 0 && (
                <div className="h-full flex items-center justify-center py-8 text-xs text-muted-foreground/40">
                  {hasActiveFilter ? 'Nenhum card corresponde ao filtro' : 'Sem tarefas nesta lista'}
                </div>
              )}
            </div>

            {/* Adicionar card */}
            <div className="p-2 border-t border-white/5 bg-black/20 rounded-b-2xl">
              {activeAddCardColId === column.id ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    placeholder="Insira um título ou cole um link"
                    value={newCardTitles[column.id] || ''}
                    onChange={e => setNewCardTitles({ ...newCardTitles, [column.id]: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddCard(column.id);
                      }
                      if (e.key === 'Escape') {
                        setActiveAddCardColId(null);
                      }
                    }}
                    rows={2}
                    className="w-full bg-[#22252a] border border-white/5 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground outline-none resize-none shadow-inner"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddCard(column.id)}
                      className="px-4 py-1.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/10"
                    >
                      Adicionar Cartão
                    </button>
                    <button
                      onClick={() => {
                        setActiveAddCardColId(null);
                        setNewCardTitles({ ...newCardTitles, [column.id]: '' });
                      }}
                      className="p-1.5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-xl transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setActiveAddCardColId(column.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl transition-all group"
                >
                  <Plus className="w-4 h-4 text-muted-foreground group-hover:text-white" />
                  <span>Adicionar um cartão</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Nova coluna */}
        <div className="w-72 shrink-0 bg-[#101214]/80 border border-dashed border-white/10 hover:border-white/20 rounded-2xl p-4 transition-all">
          <form onSubmit={handleAddColumn} className="space-y-3">
            <span className="text-xs font-bold text-white/70 block">Criar Nova Lista</span>
            <input type="text" placeholder="Título da lista..." value={newColumnTitle} onChange={e => setNewColumnTitle(e.target.value)}
              className="w-full bg-[#1e2126] border border-white/5 focus:border-primary/50 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground outline-none" />
            <button type="submit" className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /><span>Adicionar Lista</span>
            </button>
          </form>
        </div>
      </div>

      {/* ── Modal do Card ── */}
      <AnimatePresence>
        {activeTask && activeTaskColId && (
          <CardModal
            task={activeTask}
            colId={activeTaskColId}
            columns={columns}
            members={members}
            currentUserId={currentUserId}
            onClose={() => setActiveTask(null)}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onMoveTask={handleMoveTask}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default KanbanPage;
