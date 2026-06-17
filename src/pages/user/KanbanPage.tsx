import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, X, LayoutGrid, List, Search,
  MoreHorizontal, SortAsc, SortDesc, Paintbrush, Copy,
  Paperclip, FileIcon, Trash2, CheckSquare, AlignLeft as AlignLeftIcon, Check, Loader2, Upload, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import CardModal, { Task, Column, MemberInfo, initials, avatarColor } from '../../components/user/CardModal';
import BoardListView from '../../components/user/BoardListView';
import { useBoardBackground } from '../../context/BoardBackgroundContext';
import { createPortal } from 'react-dom';

// ────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────

interface Board { id: string; title: string; background: string; bg_type: 'gradient' | 'image'; owner_id: string; ticket_column_id?: string | null; cover_image?: string | null; }

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



const PRESET_LABELS = [
  { text: 'BAIXA', color: '#22c55e' },
  { text: 'MÉDIA', color: '#eab308' },
  { text: 'ALTA', color: '#ef4444' },
];

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Sub-componente para gerenciar o layout de capa do card no Kanban de forma dinâmica (como o Trello)
const TaskCardCover: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  const [isLandscape, setIsLandscape] = useState<boolean | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      if (img.height > 0) {
        setIsLandscape(img.width >= img.height);
      }
    };
  }, [imageUrl]);

  if (isLandscape === null) {
    // Container vazio/esqueleto de carregamento com altura média
    return <div className="h-32 w-full bg-white/5 animate-pulse shrink-0 border-b border-white/5" />;
  }

  if (isLandscape) {
    // Imagem horizontal (Landscape) -> bg-cover com altura de 114px (Trello usa ~114px, máximo de 129px)
    return (
      <div 
        className="w-full h-[114px] max-h-[129px] shrink-0 border-b border-white/5 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  } else {
    // Imagem vertical (Portrait) -> bg-contain com altura de 260px e preenchimento de bordas (backdrop blur)
    return (
      <div className="h-[260px] max-h-[260px] w-full shrink-0 overflow-hidden relative border-b border-white/5 bg-black/40">
        {/* Background desfocado da imagem para preencher as bordas com cores compatíveis */}
        <div 
          className="absolute inset-0 bg-cover bg-center filter blur-lg opacity-40 scale-110 select-none pointer-events-none"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
        {/* Imagem principal contida e centralizada */}
        <img src={imageUrl} alt="" className="w-full h-full object-contain relative z-10 select-none pointer-events-none" />
      </div>
    );
  }
};

const TicketFilePreview: React.FC<{ file: File; onZoom: () => void }> = ({ file, onZoom }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!previewUrl) return null;

  if (isImage) {
    return (
      <div className="relative w-full h-full group/thumb cursor-pointer" onClick={(e) => { e.stopPropagation(); onZoom(); }}>
        <img src={previewUrl} alt={file.name} className="w-full h-full object-cover rounded-lg" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l5 5M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
          </svg>
        </div>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div 
        className="relative w-full h-full rounded-lg overflow-hidden bg-black flex items-center justify-center group/thumb cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onZoom(); }}
        onMouseEnter={(e) => {
          const video = e.currentTarget.querySelector('video');
          if (video) video.play().catch(() => {});
        }}
        onMouseLeave={(e) => {
          const video = e.currentTarget.querySelector('video');
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
        }}
      >
        <video src={previewUrl} className="w-full h-full object-cover" muted loop playsInline />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover/thumb:opacity-100 transition-opacity duration-200">
          <span className="p-1 bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l5 5M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
            </svg>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white/5 flex items-center justify-center rounded-lg border border-white/5">
      <FileIcon className="w-5 h-5 text-red-400" />
    </div>
  );
};

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
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});
  const [activeAddCardColId, setActiveAddCardColId] = useState<string | null>(null);

  // Menu "..." das colunas
  const [openColMenuId, setOpenColMenuId] = useState<string | null>(null);
  const [confirmClearColId, setConfirmClearColId] = useState<string | null>(null);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Painel de background
  const [isBackgroundPanelOpen, setIsBackgroundPanelOpen] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const bgPanelRef = useRef<HTMLDivElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

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
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);

  // Modo de Visualização
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Edição do título do quadro
  const [isEditingBoardTitle, setIsEditingBoardTitle] = useState(false);
  const [editingBoardTitle, setEditingBoardTitle] = useState('');

  // Chamado (User)
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');

  // Checklist expandido no card (Kanban)
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketSector, setTicketSector] = useState('');
  const [ticketPriority, setTicketPriority] = useState<{text: string, color: string} | null>(null);
  const [ticketDueDate, setTicketDueDate] = useState('');
  const [ticketChecklist, setTicketChecklist] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);

  const [ticketLightboxFile, setTicketLightboxFile] = useState<File | null>(null);
  const [ticketLightboxUrl, setTicketLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketLightboxFile) {
      setTicketLightboxUrl(null);
      return;
    }
    const url = URL.createObjectURL(ticketLightboxFile);
    setTicketLightboxUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [ticketLightboxFile]);

  const handleTicketFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setTicketFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (ticketFileInputRef.current) ticketFileInputRef.current.value = '';
  };
  
  const handleRemoveTicketFile = (index: number) => {
    setTicketFiles(prev => prev.filter((_, i) => i !== index));
  };

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
    comments_count: t.card_comments?.[0]?.count || 0,
  });

  const getDueDateInfo = (dueDate: string | null, isDone: boolean) => {
    if (!dueDate) return null;
    const now = new Date();
    
    // Tratamento para evitar que fusos horários mudem o dia (ex: GMT-3 puxa 1 dia atrás)
    const cleanDateStr = dueDate.split('T')[0];
    const [year, month, day] = cleanDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const formattedDate = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
    if (isDone) return { text: formattedDate, className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    if (diff < 0) return { text: `${formattedDate} (Atrasado)`, className: 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' };
    if (days <= 1) return { text: `${formattedDate} (Breve)`, className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
    return { text: formattedDate, className: 'bg-white/5 text-muted-foreground border border-white/5' };
  };

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
        .from('boards').select('id, title, background, bg_type, owner_id, ticket_column_id, cover_image').eq('id', boardId).single();
      if (boardError) throw boardError;
      setBoard(boardData);
      setBoardBackground({ bg_type: boardData.bg_type, background: boardData.background });

      const { data: membersData } = await supabase
        .from('board_members').select('user_id, profiles:user_id (full_name, email)').eq('board_id', boardId);
      const { data: ownerProfile } = await supabase
        .from('profiles').select('id, full_name, email').eq('id', boardData.owner_id).single();

      const formattedMembers: MemberInfo[] = [];
      if (ownerProfile) formattedMembers.push({ user_id: ownerProfile.id, full_name: ownerProfile.full_name, email: ownerProfile.email });
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
          .from('tasks').select('*, card_comments(count)').in('column_id', colIds).order('position', { ascending: true });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_comments' }, () => fetchBoardDataRef.current())
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

  // Lidar com Ctrl+V de arquivos no modal de chamado
  useEffect(() => {
    if (!isTicketModalOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const pastedFiles = Array.from(e.clipboardData.files);
        setTicketFiles(prev => [...prev, ...pastedFiles]);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isTicketModalOpen]);

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

  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !boardId || !currentUserId) return;
    const file = e.target.files[0];
    try {
      setIsUploadingBg(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `boards/${boardId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('card-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('card-attachments').getPublicUrl(filePath);
      
      await supabase.from('boards').update({ cover_image: publicUrl }).eq('id', boardId);
      setBoard(prev => prev ? { ...prev, cover_image: publicUrl } : null);
    } catch (err) {
      console.error('Erro ao fazer upload da imagem de capa:', err);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setIsUploadingBg(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = '';
    }
  };

  // ── Filtros ──
  const filteredColumns = useMemo(() => {
    const hasFilter = searchText.trim() || filterLabelColor || filterAssigneeId || filterPriorities.length > 0;
    if (!hasFilter) return columns;
    return columns.map(col => ({
      ...col,
      tasks: col.tasks.filter(task => {
        const matchText = !searchText.trim() || task.title.toLowerCase().includes(searchText.toLowerCase());
        const matchLabel = !filterLabelColor || task.labels.some(l => l.color === filterLabelColor);
        const matchAssignee = !filterAssigneeId || task.assignees.some(a => a.user_id === filterAssigneeId);
        const matchPriority = filterPriorities.length === 0 || task.labels.some(l => filterPriorities.includes(l.text.toUpperCase()));
        return matchText && matchLabel && matchAssignee && matchPriority;
      })
    }));
  }, [columns, searchText, filterLabelColor, filterAssigneeId, filterPriorities]);

  const hasActiveFilter = !!(searchText.trim() || filterLabelColor || filterAssigneeId || filterPriorities.length > 0);
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
    if (!boardId || (currentUserRole !== 'admin' && currentUserRole !== 'developer') || !newColumnTitle.trim()) return;
    try {
      await supabase.from('columns').insert({ board_id: boardId, title: newColumnTitle.trim(), position: columns.length });
      setNewColumnTitle('');
      setIsAddingColumn(false);
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
  const handleSortColumn = async (colId: string, mode: 'az' | 'za') => {
    const col = columns.find(c => c.id === colId);
    if (!col) return;
    const sorted = [...col.tasks].sort((a, b) => {
      if (mode === 'az') return a.title.localeCompare(b.title, 'pt-BR');
      return b.title.localeCompare(a.title, 'pt-BR');
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

  const handleCopyColumn = async (colId: string) => {
    const colToCopy = columns.find(c => c.id === colId);
    if (!colToCopy || !boardId) return;
    
    try {
      const newPos = columns.length;
      const { data: newColData, error: colError } = await supabase
        .from('columns')
        .insert({
          board_id: boardId,
          title: `${colToCopy.title} (Cópia)`,
          position: newPos
        })
        .select('*')
        .single();
        
      if (colError) throw colError;
      
      if (colToCopy.tasks && colToCopy.tasks.length > 0) {
        const tasksToInsert = colToCopy.tasks.map(task => ({
          column_id: newColData.id,
          title: task.title,
          description: task.description || '',
          checklist: task.checklist || [],
          labels: task.labels || [],
          assignees: task.assignees || [],
          due_date: task.due_date || null,
          cover_color: task.cover_color || null,
          is_done: !!task.is_done,
          position: task.position,
          checklist_title: task.checklist_title || null,
          cover_image: task.cover_image || null
        }));
        
        const { error: tasksError } = await supabase
          .from('tasks')
          .insert(tasksToInsert);
          
        if (tasksError) throw tasksError;
      }
      
      setOpenColMenuId(null);
    } catch (err) {
      console.error('Erro ao duplicar lista:', err);
    }
  };

  const handleMoveAllTasks = async (sourceColId: string, targetColId: string) => {
    const sourceCol = columns.find(c => c.id === sourceColId);
    if (!sourceCol || !sourceCol.tasks.length) return;
    
    try {
      const targetCol = columns.find(c => c.id === targetColId);
      if (!targetCol) return;
      
      const startPos = targetCol.tasks.length;
      
      const updatePromises = sourceCol.tasks.map((task, index) => 
        supabase
          .from('tasks')
          .update({
            column_id: targetColId,
            position: startPos + index
          })
          .eq('id', task.id)
      );
      
      await Promise.all(updatePromises);
      setOpenColMenuId(null);
    } catch (err) {
      console.error('Erro ao mover todos os cartões:', err);
    }
  };

  const handleSetTicketColumn = async (colId: string) => {
    if (!boardId || (currentUserRole !== 'admin' && currentUserRole !== 'developer')) return;
    try {
      const newTicketColId = board?.ticket_column_id === colId ? null : colId;
      await supabase.from('boards').update({ ticket_column_id: newTicketColId }).eq('id', boardId);
      setBoard(prev => prev ? { ...prev, ticket_column_id: newTicketColId } : null);
      setOpenColMenuId(null);
    } catch (err) {
      console.error('Erro ao definir coluna de chamados:', err);
    }
  };

  const handleToggleCardChecklistItem = async (taskId: string, colId: string, itemId: string) => {
    if (currentUserRole !== 'admin' && currentUserRole !== 'developer') return;
    const col = columns.find(c => c.id === colId);
    const task = col?.tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedChecklist = task.checklist.map(item =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    setColumns(prev => prev.map(c => {
      if (c.id === colId) {
        return {
          ...c,
          tasks: c.tasks.map(t => t.id === taskId ? { ...t, checklist: updatedChecklist } : t)
        };
      }
      return c;
    }));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ checklist: updatedChecklist })
        .eq('id', taskId);
      if (error) throw error;
    } catch (err) {
      console.error('Erro ao atualizar checklist do cartão:', err);
      fetchBoardData();
    }
  };

  // ── Cards ──
  const handleAddCard = async (columnId: string) => {
    if (currentUserRole !== 'admin' && currentUserRole !== 'developer') return;
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

  const handleSubmitTicket = async () => {
    if (isSubmittingTicket) return;
    if (!board?.ticket_column_id) {
      alert('O administrador ainda não configurou uma coluna de chamados para este quadro.');
      return;
    }
    if (!ticketTitle.trim()) return;

    try {
      setIsSubmittingTicket(true);
      const targetCol = columns.find(c => c.id === board.ticket_column_id);
      const position = targetCol ? targetCol.tasks.length : 0;
      
      const newLabels: { id: string; text: string; color: string }[] = [];
      if (ticketPriority) {
        newLabels.push({ id: crypto.randomUUID(), text: ticketPriority.text, color: ticketPriority.color });
      }
      if (ticketSector.trim()) {
        newLabels.push({ id: crypto.randomUUID(), text: ticketSector.trim(), color: '#64748b' });
      }

      const checklistItems = ticketChecklist.map(text => ({
        id: crypto.randomUUID(),
        text,
        done: false
      }));

      const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
        column_id: board.ticket_column_id,
        title: ticketTitle.trim(),
        description: ticketDesc.trim(),
        position,
        labels: newLabels,
        checklist: checklistItems,
        assignees: [],
        due_date: ticketDueDate || null,
        cover_color: null,
        is_done: false
      }).select().single();

      if (taskError) throw taskError;

      if (ticketFiles.length > 0 && currentUserId && newTask) {
        for (const file of ticketFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${newTask.id}/${fileName}`;
          
          await supabase.storage.from('card-attachments').upload(filePath, file);
          const { data: { publicUrl } } = supabase.storage.from('card-attachments').getPublicUrl(filePath);
          
          await supabase.from('card_attachments').insert({
            task_id: newTask.id,
            user_id: currentUserId,
            file_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            file_type: file.type
          });
        }
      }

      // Limpar formulário
      setIsTicketModalOpen(false);
      setTicketTitle('');
      setTicketDesc('');
      setTicketSector('');
      setTicketPriority(null);
      setTicketDueDate('');
      setTicketChecklist([]);
      setNewChecklistItem('');
      setTicketFiles([]);
      
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 3000);
    } catch (err) {
      console.error('Erro ao criar chamado:', err);
      alert('Ocorreu um erro ao criar o chamado. Tente novamente.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // ── Membros do quadro ──
  const handleAddMember = async (userId: string) => {
    if (!boardId || (currentUserRole !== 'admin' && currentUserRole !== 'developer')) return;
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
    if (!boardId || (currentUserRole !== 'admin' && currentUserRole !== 'developer')) return;
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
  const [draggableColId, setDraggableColId] = useState<string | null>(null);

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

  const handleSaveBoardTitle = async () => {
    if (!boardId || !editingBoardTitle.trim() || editingBoardTitle.trim() === board?.title || (currentUserRole !== 'admin' && currentUserRole !== 'developer')) {
      setIsEditingBoardTitle(false);
      return;
    }
    try {
      const newTitle = editingBoardTitle.trim();
      await supabase.from('boards').update({ title: newTitle }).eq('id', boardId);
      setBoard(prev => prev ? { ...prev, title: newTitle } : null);
    } catch (err) {
      console.error('Erro ao salvar título do quadro:', err);
    } finally {
      setIsEditingBoardTitle(false);
    }
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
  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>;
  }

  return (
    <>
    <div className="space-y-4 h-full flex flex-col relative overflow-hidden">

      {/* ── Top Bar (Cabeçalho Secundário Compacto) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 shrink-0">
        
        {/* Lado Esquerdo: Título e Voltar */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <button 
            onClick={handleBack} 
            className="p-1.5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-muted-foreground hover:text-white"
            title="Voltar para a Área de Trabalho"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {isEditingBoardTitle ? (
            <input
              autoFocus
              value={editingBoardTitle}
              onChange={e => setEditingBoardTitle(e.target.value)}
              onBlur={handleSaveBoardTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveBoardTitle();
                if (e.key === 'Escape') setIsEditingBoardTitle(false);
              }}
              className="text-lg font-bold text-white bg-black/30 border border-primary/50 rounded-xl px-2 py-0.5 outline-none w-64"
            />
          ) : (
            <h1 
              onClick={() => {
                if (currentUserRole === 'admin' || currentUserRole === 'developer') {
                  setEditingBoardTitle(board?.title || '');
                  setIsEditingBoardTitle(true);
                }
              }}
              className={`text-lg font-bold text-white tracking-tight ${(currentUserRole === 'admin' || currentUserRole === 'developer') ? 'cursor-pointer hover:underline' : ''}`}
              title={(currentUserRole === 'admin' || currentUserRole === 'developer') ? "Clique para renomear o quadro" : undefined}
            >
              {board?.title || 'Projeto'}
            </h1>
          )}
        </div>

        {/* Meio: Botão Abrir Chamado (Apenas User) */}
        {(currentUserRole !== 'admin' && currentUserRole !== 'developer') && (
          <div className="flex justify-center shrink-0">
            <button 
              onClick={() => setIsTicketModalOpen(true)}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 border border-white/10"
            >
              <Plus className="w-4 h-4" />
              Abrir chamado
            </button>
          </div>
        )}
 
        {/* Lado Direito: Filtros, View Toggle e Ações */}
        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
          
          {/* Toggle de Visualização (Kanban / Lista) */}
          <div className="hidden sm:flex items-center bg-black/20 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${viewMode === 'kanban' ? 'bg-primary text-white shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              title="Visualização em Quadro (Kanban)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          {/* Buscar cards */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchText} 
              onChange={e => setSearchText(e.target.value)}
              className="pl-8 pr-3 h-8 bg-black/30 border border-white/10 focus:border-primary/50 rounded-xl text-xs text-white placeholder:text-muted-foreground outline-none w-32 focus:w-40 transition-all duration-200" 
            />
          </div>

          {/* Filtros de Prioridade */}
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/10 h-8">
            {PRESET_LABELS.map(p => {
              const isSelected = filterPriorities.includes(p.text);
              return (
                <button
                  key={p.text}
                  onClick={() => {
                    setFilterPriorities(prev => 
                      prev.includes(p.text) 
                        ? prev.filter(x => x !== p.text) 
                        : [...prev, p.text]
                    );
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all border ${
                    isSelected 
                      ? 'border-white/30 text-white scale-105 shadow-md shadow-black/40' 
                      : 'border-transparent text-white/50 hover:text-white/80'
                  }`}
                  style={{ backgroundColor: isSelected ? p.color : 'transparent' }}
                >
                  {p.text}
                </button>
              );
            })}
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
                     <span className="font-bold text-xs text-white">Membros do Projeto</span>
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
                         {(currentUserRole === 'admin' || currentUserRole === 'developer') && m.user_id !== board?.owner_id && (
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
 
                   {/* Adicionar Membros (Apenas se for Admin ou Desenvolvedor) */}
                   {(currentUserRole === 'admin' || currentUserRole === 'developer') && (
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
 
                       {/* Lista de usuários cadastrados que NÃO estão no projeto */}
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
                           <p className="text-[10px] text-muted-foreground italic text-center py-2">Todos os usuários já fazem parte deste projeto.</p>
                         )}
                       </div>
                     </div>
                   )}
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
 
           {/* Editar Background */}
           {(currentUserRole === 'admin' || currentUserRole === 'developer') && (
             <div className="relative" ref={bgPanelRef}>
               <button
                 onClick={() => setIsBackgroundPanelOpen(!isBackgroundPanelOpen)}
                 className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/10 transition-all h-8"
               >
                 <Paintbrush className="w-4 h-4 text-muted-foreground" />
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
                       <span className="font-bold text-xs text-white">Escolher Fundo do Projeto</span>
                       <button onClick={() => setIsBackgroundPanelOpen(false)}>
                         <X className="w-4 h-4 text-muted-foreground hover:text-white" />
                       </button>
                     </div>
                      <div className="flex flex-col gap-2 mb-3">
                        <input
                          type="file"
                          accept="image/*"
                          ref={bgFileInputRef}
                          className="hidden"
                          onChange={handleUploadBackground}
                        />
                        <button
                          onClick={() => bgFileInputRef.current?.click()}
                          disabled={isUploadingBg}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-xs font-semibold text-primary transition-all disabled:opacity-50"
                        >
                          {isUploadingBg ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              Fazer upload de capa
                            </>
                          )}
                        </button>
                        {board?.cover_image && (
                          <button
                            onClick={async () => {
                              try {
                                const { error } = await supabase.from('boards').update({ cover_image: null }).eq('id', boardId);
                                if (error) throw error;
                                setBoard(prev => prev ? { ...prev, cover_image: null } : null);
                              } catch (err) {
                                console.error('Erro ao remover imagem de capa:', err);
                              }
                            }}
                            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold transition-all"
                          >
                            Remover imagem de capa
                          </button>
                        )}
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
           )}

           {/* Limpar filtros */}
           {hasActiveFilter && (
             <button 
               onClick={() => { setSearchText(''); setFilterLabelColor(null); setFilterAssigneeId(null); setFilterPriorities([]); }}
               className="flex items-center justify-center w-8 h-8 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all h-8 shrink-0"
               title="Limpar todos os filtros"
             >
               <X className="w-4 h-4" />
             </button>
           )}

           {totalFilteredCards !== null && (
             <span className="text-[10px] text-muted-foreground font-semibold bg-white/5 px-2.5 py-1 rounded-xl border border-white/5 h-8 flex items-center shrink-0">
               {totalFilteredCards} card{totalFilteredCards !== 1 ? 's' : ''}
             </span>
           )}
        </div>
      </div>

      {/* ── Visualização: Kanban ou Lista ── */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start select-none overflow-y-hidden custom-scrollbar">
          {filteredColumns.map(column => (
            <div key={column.id} 
              draggable={(currentUserRole === 'admin' || currentUserRole === 'developer') && draggableColId === column.id}
              onDragStart={e => handleColDragStart(e, column.id)}
              onDragEnd={() => setDraggableColId(null)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { if (draggedColId) handleColDrop(e, column.id); else if (draggedTaskId) handleCardDrop(e, column.id); }}
              className="w-72 shrink-0 bg-[#101214] border border-white/5 rounded-2xl flex flex-col max-h-full shadow-xl">

              {/* Header da coluna */}
              <div 
                onMouseDown={() => { if (currentUserRole === 'admin' || currentUserRole === 'developer') setDraggableColId(column.id); }}
                onMouseUp={() => { if (currentUserRole === 'admin' || currentUserRole === 'developer') setDraggableColId(null); }}
                className={`p-3 flex items-center justify-between ${(currentUserRole === 'admin' || currentUserRole === 'developer') ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {editingColumnId === column.id ? (
                    <input autoFocus value={editingColumnTitle} onChange={e => setEditingColumnTitle(e.target.value)}
                      onBlur={() => handleSaveColumnTitle(column.id)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveColumnTitle(column.id); if (e.key === 'Escape') setEditingColumnId(null); }}
                      className="flex-1 bg-black/30 border border-white/10 rounded-xl px-2 py-0.5 text-xs text-white outline-none focus:border-primary/50 font-bold" />
                  ) : (
                    <span onClick={() => { if (currentUserRole === 'admin' || currentUserRole === 'developer') { setEditingColumnId(column.id); setEditingColumnTitle(column.title); } }}
                      className={`font-bold text-white text-sm truncate ${(currentUserRole === 'admin' || currentUserRole === 'developer') ? 'cursor-pointer hover:underline' : ''}`} title={(currentUserRole === 'admin' || currentUserRole === 'developer') ? "Clique para renomear" : undefined}>
                      {column.title}
                    </span>
                  )}
                  {board?.ticket_column_id === column.id && (
                    <span className="shrink-0 text-[9px] font-bold bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-lg flex items-center gap-1" title="Coluna destino de novos chamados">
                      Chamados
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] font-bold bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full">{column.tasks.length}</span>
                </div>

                {/* Menu "..." da coluna */}
                {(currentUserRole === 'admin' || currentUserRole === 'developer') && (
                  <div className="relative" ref={openColMenuId === column.id ? colMenuRef : undefined}>
                    <button onClick={e => { e.stopPropagation(); setOpenColMenuId(openColMenuId === column.id ? null : column.id); setConfirmClearColId(null); }}
                      className="ml-1 p-1.5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-xl transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {openColMenuId === column.id && (
                        <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }}
                          className="absolute right-0 mt-1 w-52 rounded-2xl bg-[#0c0c0c] border border-white/10 shadow-2xl z-30 overflow-hidden">
                          <div className="p-2 space-y-0.5 max-h-96 overflow-y-auto custom-scrollbar">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1">Ações da lista</p>
                            <button onClick={() => { setActiveAddCardColId(column.id); setOpenColMenuId(null); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                              <Plus className="w-3.5 h-3.5 text-muted-foreground" /> Adicionar cartão
                            </button>
                            <button onClick={() => handleCopyColumn(column.id)} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Duplicar lista
                            </button>
                            <button onClick={() => handleSetTicketColumn(column.id)} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                              <Plus className="w-3.5 h-3.5 text-muted-foreground" /> {board?.ticket_column_id === column.id ? 'Remover dos Chamados' : 'Definir para Chamados'}
                            </button>

                            {columns.length > 1 && column.tasks.length > 0 && (
                              <div className="py-1 border-t border-white/5 mt-1">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-0.5">Mover todos os cards para</p>
                                {columns
                                  .filter(c => c.id !== column.id)
                                  .map(c => (
                                    <button
                                      key={`move-all-to-${c.id}`}
                                      onClick={() => handleMoveAllTasks(column.id, c.id)}
                                      className="w-full flex items-center gap-2 px-3 py-1 text-[11px] text-white/70 hover:text-white hover:bg-white/5 rounded-lg text-left truncate"
                                    >
                                      → {c.title}
                                    </button>
                                  ))}
                              </div>
                            )}

                            <div className="h-px bg-white/5 my-1" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1">Ordenar lista</p>
                            <button onClick={() => handleSortColumn(column.id, 'az')} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                              <SortAsc className="w-3.5 h-3.5 text-muted-foreground" /> A → Z (título)
                            </button>
                            <button onClick={() => handleSortColumn(column.id, 'za')} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/5 rounded-xl text-left">
                              <SortDesc className="w-3.5 h-3.5 text-muted-foreground" /> Z → A (título)
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
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 p-2.5 space-y-2 overflow-y-auto min-h-0">
                {column.tasks.map((task, index) => {
                  return (
                    <div key={task.id} draggable={currentUserRole === 'admin' || currentUserRole === 'developer'}
                      onDragStart={e => handleCardDragStart(e, task.id, column.id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleCardDrop(e, column.id, index)}
                      onClick={() => { setActiveTask(task); setActiveTaskColId(column.id); }}
                      className={`bg-[#22252a] hover:bg-[#2b2e35] border border-white/5 hover:border-white/10 rounded-2xl shadow transition-all duration-200 group overflow-hidden flex flex-col ${(currentUserRole === 'admin' || currentUserRole === 'developer') ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
                      {task.cover_image ? (
                        <TaskCardCover imageUrl={task.cover_image} />
                      ) : task.cover_color ? (
                        <div className="h-8 w-full shrink-0" style={{ backgroundColor: task.cover_color }} />
                      ) : null}
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
                                if (currentUserRole !== 'admin' && currentUserRole !== 'developer') return;
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
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {task.description && <div title="Possui descrição"><AlignLeftIcon className="w-3.5 h-3.5 text-muted-foreground/70" /></div>}
                            {task.checklist?.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedChecklists(prev => ({
                                    ...prev,
                                    [task.id]: !prev[task.id]
                                  }));
                                }}
                                title="Expandir checklist"
                                className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-all ${
                                  expandedChecklists[task.id]
                                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-sm shadow-blue-500/10'
                                    : task.checklist.every(i => i.done)
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-transparent hover:bg-white/5 text-muted-foreground'
                                }`}
                              >
                                <CheckSquare className="w-3 h-3" />
                                <span>{task.checklist.filter(i => i.done).length}/{task.checklist.length}</span>
                              </button>
                            )}

                            {/* SLA/Prazo */}
                            {task.due_date && (() => {
                              const info = getDueDateInfo(task.due_date, !!task.is_done);
                              if (!info) return null;
                              return (
                                <div className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${info.className}`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  <span>{info.text}</span>
                                </div>
                              );
                            })()}

                            {/* Indicador de Comentários com Pontinho Laranja Pulsante */}
                            {(task.comments_count ?? 0) > 0 && (
                              <div className="flex items-center gap-1 text-muted-foreground/70 relative pr-2" title={`${task.comments_count ?? 0} comentário(s)`}>
                                <MessageSquare className="w-3 h-3" />
                                <span className="text-[10px] font-semibold">{task.comments_count}</span>
                                <span className="absolute top-0 right-0 flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                                </span>
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

                        {/* Renderização do Checklist Inline do Card */}
                        {expandedChecklists[task.id] && task.checklist?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-1.5">
                            {task.checklist.map(item => (
                              <div
                                key={item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (currentUserRole === 'admin' || currentUserRole === 'developer') {
                                    handleToggleCardChecklistItem(task.id, column.id, item.id);
                                  }
                                }}
                                className={`flex items-center gap-2 p-1 rounded-xl transition-colors ${
                                  (currentUserRole === 'admin' || currentUserRole === 'developer')
                                    ? 'hover:bg-white/5 cursor-pointer group/item'
                                    : 'cursor-default'
                                }`}
                              >
                                <button
                                  disabled={currentUserRole !== 'admin' && currentUserRole !== 'developer'}
                                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                    item.done
                                      ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/20'
                                      : 'bg-transparent border-white/20'
                                  } ${(currentUserRole === 'admin' || currentUserRole === 'developer') ? 'group-hover/item:border-blue-500/50' : ''}`}
                                >
                                  {item.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </button>
                                <span className={`text-xs truncate transition-all ${
                                  item.done ? 'line-through text-muted-foreground/60' : 'text-white/80'
                                }`}>
                                  {item.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {column.tasks.length === 0 && (
                  <div className="h-full flex items-center justify-center py-8 text-xs text-muted-foreground/40">
                    {hasActiveFilter ? 'Nenhum card corresponde ao filtro' : 'Sem tarefas nesta lista'}
                  </div>
                )}
                
                {/* Prévia do input do novo card (Trello style) */}
                {activeAddCardColId === column.id && (
                  <div className="bg-[#22252a] border border-white/5 rounded-2xl p-3 shadow-md">
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
                      className="w-full bg-transparent text-xs text-white placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Adicionar card */}
              {(currentUserRole === 'admin' || currentUserRole === 'developer') && (
                <div className="p-2 rounded-b-2xl">
                  {activeAddCardColId === column.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddCard(column.id)}
                        className="px-4 py-2 bg-[#579dff] hover:bg-[#85b8ff] text-[#1d2125] rounded-xl text-xs font-bold transition-all flex-1 sm:flex-initial"
                      >
                        Adicionar Cartão
                      </button>
                      <button
                        onClick={() => {
                          setActiveAddCardColId(null);
                          setNewCardTitles({ ...newCardTitles, [column.id]: '' });
                        }}
                        className="p-2 hover:bg-white/5 text-white/70 hover:text-white rounded-xl transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
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
              )}
            </div>
          ))}

          {/* Nova coluna */}
          {(currentUserRole === 'admin' || currentUserRole === 'developer') && (
            !isAddingColumn ? (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="w-72 shrink-0 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-2xl p-4 transition-all flex items-center gap-2 font-bold text-xs"
            >
              <Plus className="w-4 h-4 text-white/70" />
              <span>Adicionar outra lista</span>
            </button>
          ) : (
            <div className="w-72 shrink-0 bg-[#101214] border border-white/5 rounded-2xl p-4 transition-all shadow-xl">
              <form onSubmit={handleAddColumn} className="space-y-3">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Digite o nome da lista..." 
                  value={newColumnTitle} 
                  onChange={e => setNewColumnTitle(e.target.value)}
                  className="w-full bg-[#22252a] border border-white/5 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground outline-none focus:outline-none" 
                />
                <div className="flex items-center gap-2">
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-[#579dff] hover:bg-[#85b8ff] text-[#1d2125] rounded-xl text-xs font-bold transition-all"
                  >
                    Adicionar Lista
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAddingColumn(false);
                      setNewColumnTitle('');
                    }}
                    className="p-2 hover:bg-white/5 text-white/70 hover:text-white rounded-xl transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )
          )}
        </div>
      ) : (
        <BoardListView
          columns={columns}
          onTaskClick={(task, colId) => {
            setActiveTask(task);
            setActiveTaskColId(colId);
          }}
        />
      )}

      {/* ── Modal do Card ── */}
      <AnimatePresence>
        {activeTask && activeTaskColId && (
          <CardModal
            task={activeTask}
            colId={activeTaskColId}
            columns={columns}
            members={members}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onClose={() => setActiveTask(null)}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onMoveTask={handleMoveTask}
          />
        )}
      </AnimatePresence>

    </div>

      {/* ── Modal de Abrir Chamado (fora do overflow-hidden) ── */}
      <AnimatePresence>
        {isTicketModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsTicketModalOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg max-h-[90vh] bg-[#22272b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-6 border-b border-white/5 bg-[#22272b]/80 backdrop-blur-md shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Abrir Chamado</h2>
                  <p className="text-xs text-muted-foreground mt-1">Preencha os dados abaixo para solicitar uma nova tarefa.</p>
                </div>
                <button
                  onClick={() => setIsTicketModalOpen(false)}
                  className="p-2 hover:bg-white/10 text-muted-foreground hover:text-white rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="pt-24 p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white">Título do Chamado <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    placeholder="Ex: Corrigir erro na página inicial..."
                    className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-400 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-white">Setor / Identificação</label>
                    <input
                      type="text"
                      value={ticketSector}
                      onChange={(e) => setTicketSector(e.target.value)}
                      placeholder="Ex: TI, Manutenção, RH, etc."
                      className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-400 outline-none transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-white">Prazo de Resolução (SLA)</label>
                    <input
                      type="date"
                      value={ticketDueDate}
                      min={new Date().toLocaleDateString('en-CA')}
                      onChange={(e) => setTicketDueDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) {
                          // fallback para navegadores antigos
                        }
                      }}
                      className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-400 outline-none transition-all cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-white">Prioridade</label>
                  <div className="flex items-center gap-2 h-[46px]">
                    {PRESET_LABELS.map(label => (
                      <button
                        key={label.text}
                        onClick={() => setTicketPriority(label)}
                        className={`flex-1 h-full rounded-xl text-xs font-bold transition-all border ${ticketPriority?.text === label.text ? 'border-white/50 shadow-lg scale-105' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-[1.02]'}`}
                        style={{ backgroundColor: label.color, color: '#fff' }}
                      >
                        {label.text}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-white">Descrição Detalhada</label>
                  <textarea
                    value={ticketDesc}
                    onChange={(e) => setTicketDesc(e.target.value)}
                    placeholder="Descreva o que precisa ser feito com o máximo de detalhes..."
                    rows={6}
                    className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-400 outline-none transition-all resize-y min-h-[120px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-muted-foreground" />
                    Checklist de Tarefas
                  </label>
                  <div className="space-y-2">
                    {ticketChecklist.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                        <span className="flex-1 text-sm text-white">{item}</span>
                        <button
                          type="button"
                          onClick={() => setTicketChecklist(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newChecklistItem}
                        onChange={e => setNewChecklistItem(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newChecklistItem.trim()) {
                            e.preventDefault();
                            setTicketChecklist(prev => [...prev, newChecklistItem.trim()]);
                            setNewChecklistItem('');
                          }
                        }}
                        placeholder="Adicionar item (pressione Enter)"
                        className="flex-1 bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-400 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newChecklistItem.trim()) {
                            setTicketChecklist(prev => [...prev, newChecklistItem.trim()]);
                            setNewChecklistItem('');
                          }
                        }}
                        disabled={!newChecklistItem.trim()}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all border border-white/10"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                      Anexos
                    </label>
                    <button
                      onClick={() => ticketFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-xs font-semibold border border-white/5 transition-all"
                    >
                      Adicionar
                    </button>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      ref={ticketFileInputRef}
                      onChange={handleTicketFileChange}
                    />
                  </div>
                  
                  {ticketFiles.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                      {ticketFiles.map((file, i) => {
                        return (
                          <div key={i} className="flex items-center gap-3 p-2 bg-black/10 hover:bg-black/20 border border-white/5 rounded-xl group transition-all">
                            <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center border border-white/5 relative">
                              <TicketFilePreview file={file} onZoom={() => setTicketLightboxFile(file)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate" title={file.name}>{file.name}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(file.size)}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveTicketFile(i)}
                              className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-lg transition-all shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 bg-black/20">
                <button
                  onClick={() => {
                    setIsTicketModalOpen(false);
                    setTicketFiles([]);
                    setTicketSector('');
                    setTicketPriority(null);
                    setTicketChecklist([]);
                    setNewChecklistItem('');
                  }}
                  className="px-4 py-2 hover:bg-white/5 text-white/70 hover:text-white rounded-xl text-sm font-bold transition-all border border-transparent hover:border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitTicket}
                  disabled={!ticketTitle.trim() || isSubmittingTicket}
                  className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  {isSubmittingTicket ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    'Enviar Chamado'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Lightbox para os anexos do chamado (Imagens/Vídeos locais) */}
      {ticketLightboxFile && ticketLightboxUrl && createPortal(
        <AnimatePresence>
          <motion.div
            key="ticket-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setTicketLightboxFile(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') setTicketLightboxFile(null); }}
            tabIndex={-1}
          >
            {ticketLightboxFile.type.startsWith('video/') ? (
              <motion.video
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                src={ticketLightboxUrl}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-2xl shadow-2xl"
                onClick={e => e.stopPropagation()}
                style={{ colorScheme: 'dark' }}
              />
            ) : (
              <motion.img
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                src={ticketLightboxUrl}
                alt={ticketLightboxFile.name}
                className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
                onClick={e => e.stopPropagation()}
              />
            )}
            <button
              onClick={() => setTicketLightboxFile(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Notificação de Sucesso */}
      <AnimatePresence>
        {showSuccessNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-emerald-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500/20"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <span className="font-bold text-sm tracking-wide">Chamado criado com sucesso!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default KanbanPage;
