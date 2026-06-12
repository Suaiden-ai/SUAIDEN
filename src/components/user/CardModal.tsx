import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabase';
import {
  X, Check, CheckSquare, Square, AlignLeft, Tag,
  ArrowRightLeft, UserCheck, Trash2, Plus, Palette, Send,
  Paperclip, Download, FileText, Image as ImageIcon, Loader2,
  Edit2, ChevronDown, ChevronUp, MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────

export interface ChecklistItem { id: string; text: string; done: boolean; }
export interface Label { id: string; text: string; color: string; }
export interface Assignee { user_id: string; full_name: string; }

export interface Task {
  id: string; column_id: string; title: string; position: number;
  description: string; checklist: ChecklistItem[]; labels: Label[];
  due_date: string | null; assignees: Assignee[]; cover_color: string | null;
  is_done?: boolean;
  checklist_title?: string | null;
  cover_image?: string | null;
}

export interface Column { id: string; title: string; position: number; tasks: Task[]; }
export interface MemberInfo { user_id: string; full_name: string; email: string; }

interface Comment {
  id: string; task_id: string; user_id: string; content: string; created_at: string;
  profiles?: { full_name: string };
}

interface Attachment {
  id: string; task_id: string; user_id: string;
  file_name: string; file_url: string; file_size: number; file_type: string; created_at: string;
}

interface CardModalProps {
  task: Task;
  colId: string;
  columns: Column[];
  members: MemberInfo[];
  currentUserId: string | null;
  currentUserRole?: string | null;
  onClose: () => void;
  onUpdateTask: (updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => void;
  onMoveTask: (targetColId: string) => Promise<void>;
}

// ────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────

const LABEL_COLORS = [
  { name: 'Vermelho', value: '#ef4444' }, { name: 'Laranja', value: '#f97316' },
  { name: 'Amarelo', value: '#eab308' },  { name: 'Verde',   value: '#22c55e' },
  { name: 'Ciano',   value: '#06b6d4' },  { name: 'Azul',    value: '#3b82f6' },
  { name: 'Roxo',    value: '#a855f7' },  { name: 'Rosa',    value: '#ec4899' },
];

const PRESET_LABELS = [
  { text: 'BAIXA', color: '#22c55e' },
  { text: 'MÉDIA', color: '#eab308' },
  { text: 'ALTA', color: '#ef4444' },
];

const COVER_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#06b6d4','#3b82f6','#8b5cf6','#ec4899',
  '#64748b','#1e3a5f','#166534','#7c2d12',
];



function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const AVATAR_COLORS = ['#6d28d9','#0284c7','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4'];
export function avatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────

const CardModal: React.FC<CardModalProps> = ({
  task, colId, columns, members, currentUserId, currentUserRole,
  onClose, onUpdateTask, onDeleteTask, onMoveTask
}) => {
  const [taskData, setTaskData] = useState<Task>(task);

  // Campos editáveis
  const [cardTitle, setCardTitle] = useState(task.title);
  const [cardDesc, setCardDesc] = useState(task.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showChecklist, setShowChecklist] = useState((task.checklist && task.checklist.length > 0) || !!task.checklist_title);
  const [checklistTitle, setChecklistTitle] = useState(task.checklist_title || 'Checklist');
  const [isEditingChecklistTitle, setIsEditingChecklistTitle] = useState(false);
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [hideCheckedItems, setHideCheckedItems] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');

  // Sincronizar dados quando o prop task mudar (por exemplo, atualizações realtime do Supabase)
  useEffect(() => {
    setTaskData(task);
    setCardTitle(task.title);
    if (!isEditingDesc) {
      setCardDesc(task.description || '');
    }
    if (!isEditingChecklistTitle) {
      setChecklistTitle(task.checklist_title || 'Checklist');
    }
    setShowChecklist((task.checklist && task.checklist.length > 0) || !!task.checklist_title);
  }, [task, isEditingDesc, isEditingChecklistTitle]);
  
  // Popovers (Trello-like)
  const [activePopover, setActivePopover] = useState<'members' | 'labels' | 'due_date' | 'cover' | 'move' | 'checklist' | null>(null);
  
  const membersPopoverRef = useRef<HTMLDivElement>(null);
  const labelsPopoverRef = useRef<HTMLDivElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const coverPopoverRef = useRef<HTMLDivElement>(null);
  const movePopoverRef = useRef<HTMLDivElement>(null);
  const checklistPopoverRef = useRef<HTMLDivElement>(null);
  const checklistSectionRef = useRef<HTMLDivElement>(null);
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);
  const checklistInputRef = useRef<HTMLInputElement>(null);

  const [newLabelText, setNewLabelText] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].value);
  const [searchLabelQuery, setSearchLabelQuery] = useState('');
  const [showCreateLabel, setShowCreateLabel] = useState(false);

  // Comentários
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Anexos
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para expandir/recolher a descrição
  const descViewRef = useRef<HTMLDivElement>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);

  // ── Carregar comentários e anexos ──
  const fetchExtras = async () => {
    const [{ data: commentsData }, { data: attachmentsData }] = await Promise.all([
      supabase.from('card_comments').select('*, profiles:user_id (full_name)').eq('task_id', task.id).order('created_at', { ascending: true }),
      supabase.from('card_attachments').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
    ]);
    if (commentsData) setComments(commentsData);
    if (attachmentsData) setAttachments(attachmentsData);
  };

  // Determinar se o botão de mostrar mais deve ser exibido baseado na altura real da descrição
  useEffect(() => {
    if (!isEditingDesc && descViewRef.current) {
      const element = descViewRef.current;
      // Precisamos dar um pequeno delay para garantir que o layout renderizou e calculou o scrollHeight
      const checkHeight = () => {
        if (element) {
          setShowExpandButton(element.scrollHeight > 400);
        }
      };
      checkHeight();
      // Executa novamente ao redimensionar a janela caso o layout mude de largura
      window.addEventListener('resize', checkHeight);
      return () => window.removeEventListener('resize', checkHeight);
    }
  }, [taskData.description, isEditingDesc]);

  useEffect(() => {
    fetchExtras();
    const sub = supabase.channel(`card-modal-${task.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_comments', filter: `task_id=eq.${task.id}` }, fetchExtras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_attachments', filter: `task_id=eq.${task.id}` }, fetchExtras)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [task.id]);

  // Fechar popovers clicando fora
  useEffect(() => {
    const handleClickOutsidePopovers = (e: MouseEvent) => {
      if (!activePopover) return;
      
      const refs: { [key: string]: React.RefObject<HTMLDivElement> } = {
        members: membersPopoverRef,
        labels: labelsPopoverRef,
        due_date: datePopoverRef,
        cover: coverPopoverRef,
        move: movePopoverRef,
        checklist: checklistPopoverRef,
      };
      
      const activeRef = refs[activePopover];
      if (activeRef?.current && !activeRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutsidePopovers);
    return () => document.removeEventListener('mousedown', handleClickOutsidePopovers);
  }, [activePopover]);

  // Ajuste automático de altura da descrição
  useEffect(() => {
    if (isEditingDesc && descTextareaRef.current) {
      descTextareaRef.current.style.height = 'auto';
      descTextareaRef.current.style.height = `${descTextareaRef.current.scrollHeight}px`;
      descTextareaRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isEditingDesc, cardDesc]);

  // ── Update helper ──
  const update = async (updates: Partial<Task>) => {
    await onUpdateTask(updates);
    setTaskData(prev => ({ ...prev, ...updates }));
  };

  // ── Checklist ──
  const handleAddChecklist = async () => {
    if (!newChecklistItem.trim()) return;
    const item: ChecklistItem = { id: `item-${Date.now()}`, text: newChecklistItem.trim(), done: false };
    await update({ checklist: [...taskData.checklist, item] });
    setNewChecklistItem('');
    // Mantém o input aberto e foca nele novamente
    setTimeout(() => {
      checklistInputRef.current?.focus();
    }, 50);
  };
  const handleToggleChecklist = async (id: string) =>
    update({ checklist: taskData.checklist.map(i => i.id === id ? { ...i, done: !i.done } : i) });
  
  const handleSaveChecklistItemText = async (id: string) => {
    if (!editingItemText.trim()) {
      setEditingItemId(null);
      return;
    }
    await update({
      checklist: taskData.checklist.map(i => i.id === id ? { ...i, text: editingItemText.trim() } : i)
    });
    setEditingItemId(null);
  };

  const handleDeleteChecklist = async (id: string) =>
    update({ checklist: taskData.checklist.filter(i => i.id !== id) });

  const handleSaveChecklistTitle = async () => {
    setIsEditingChecklistTitle(false);
    const trimmed = checklistTitle.trim() || 'Checklist';
    setChecklistTitle(trimmed);
    await update({ checklist_title: trimmed });
  };

  const handleCreateChecklist = async () => {
    const titleToSave = checklistTitle.trim() || 'Checklist';
    setChecklistTitle(titleToSave);
    setShowChecklist(true);
    setActivePopover(null);
    await update({ checklist_title: titleToSave });
    setTimeout(() => checklistSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleDeleteEntireChecklist = async () => {
    setShowChecklist(false);
    setChecklistTitle('Checklist');
    setHideCheckedItems(false);
    await update({ checklist: [], checklist_title: null });
  };

  // ── Labels ──
  const getLabelStyle = (label: Label) => {
    return { backgroundColor: label.color };
  };

  const handleTogglePresetLabel = async (preset: { text: string; color: string }) => {
    const isAlreadySelected = taskData.labels.some(
      l => l.text.toLowerCase() === preset.text.toLowerCase()
    );
    let updatedLabels: Label[];
    if (isAlreadySelected) {
      updatedLabels = taskData.labels.filter(
        l => l.text.toLowerCase() !== preset.text.toLowerCase()
      );
    } else {
      const filteredLabels = taskData.labels.filter(
        l => !PRESET_LABELS.some(p => p.text.toLowerCase() === l.text.toLowerCase())
      );
      const newLabel: Label = {
        id: `prioridade-${preset.text.toLowerCase()}`,
        text: preset.text,
        color: preset.color
      };
      updatedLabels = [...filteredLabels, newLabel];
    }
    await update({ labels: updatedLabels });
  };

  const handleAddLabel = async () => {
    if (!newLabelText.trim()) return;
    const label: Label = { id: `lbl-${Date.now()}`, text: newLabelText.trim(), color: newLabelColor };
    await update({ labels: [...taskData.labels, label] });
    setNewLabelText('');
  };
  const handleRemoveLabel = async (id: string) =>
    update({ labels: taskData.labels.filter(l => l.id !== id) });



  // ── Assignees ──
  const handleToggleAssignee = async (member: MemberInfo) => {
    const cleanName = member.full_name.replace(' (Dono)', '');
    const isAssigned = taskData.assignees.some(a => a.user_id === member.user_id);
    const updatedAssignees = isAssigned
      ? taskData.assignees.filter(a => a.user_id !== member.user_id)
      : [...taskData.assignees, { user_id: member.user_id, full_name: cleanName }];
    await update({ assignees: updatedAssignees });
  };

  // ── Comentários ──
  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUserId) return;
    setIsSendingComment(true);
    try {
      const { data: newComment, error } = await supabase.from('card_comments').insert({ 
        task_id: task.id, 
        user_id: currentUserId, 
        content: commentText.trim() 
      }).select('*, profiles:user_id (full_name)').single();
      
      if (!error && newComment) {
        setComments(prev => [...prev, newComment]);
      } else {
        fetchExtras();
      }
      setCommentText('');
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('card_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  // ── Anexos ──
  const uploadFile = async (file: File) => {
    if (!currentUserId) return;
    setIsUploading(true);
    try {
      const filePath = `${task.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('card-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('card-attachments').getPublicUrl(filePath);
      
      const { data: newAtt, error: insertError } = await supabase.from('card_attachments').insert({
        task_id: task.id, user_id: currentUserId,
        file_name: file.name, file_url: publicUrl,
        file_size: file.size, file_type: file.type,
      }).select('*').single();

      if (!insertError && newAtt) {
        setAttachments(prev => [newAtt, ...prev]);
      } else {
        fetchExtras();
      }
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Suporte a colar imagens diretamente da área de transferência (Ctrl + V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !currentUserId) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const fileName = file.name || `clipboard-image-${Date.now()}.png`;
            const fileWithName = new File([file], fileName, { type: file.type });
            await uploadFile(fileWithName);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [task.id, currentUserId]);

  const handleDeleteAttachment = async (attachment: Attachment) => {
    try {
      // Se o anexo deletado for a capa atual, removemos ela da task
      if (taskData.cover_image === attachment.file_url) {
        await update({ cover_image: null });
      }

      const filePath = attachment.file_url.split('/card-attachments/')[1];
      await supabase.storage.from('card-attachments').remove([filePath]);
      await supabase.from('card_attachments').delete().eq('id', attachment.id);
      
      // Atualizar o estado local imediatamente
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    } catch (err) {
      console.error('Erro ao remover anexo:', err);
    }
  };

  // ── Render ──
  const totalChecklist = taskData.checklist.length;
  const doneChecklist = taskData.checklist.filter(i => i.done).length;
  const checklistPct = totalChecklist > 0 ? Math.round((doneChecklist / totalChecklist) * 100) : 0;

  const modalPortal = createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pt-4 pb-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[1080px] bg-[#22272b] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] min-h-[92vh] overflow-hidden">

        {/* Capa */}
        {(taskData.cover_image || taskData.cover_color) && (
          <div 
            className={`w-full rounded-t-2xl relative transition-all group overflow-hidden shrink-0 ${
              taskData.cover_image ? 'h-[160px] bg-black/40' : 'h-[116px]'
            }`} 
            style={{ 
              backgroundColor: taskData.cover_color || undefined,
            }}
          >
            {taskData.cover_image && (
              <>
                {/* Background desfocado da imagem para preencher as bordas com cores compatíveis */}
                <div 
                  className="absolute inset-0 bg-cover bg-center filter blur-xl opacity-40 scale-110 select-none pointer-events-none"
                  style={{ backgroundImage: `url(${taskData.cover_image})` }}
                />
                {/* Imagem principal centralizada sem cortes */}
                <img 
                  src={taskData.cover_image} 
                  alt="" 
                  onClick={() => setLightboxUrl(taskData.cover_image || null)}
                  className="w-full h-full object-contain relative z-10 cursor-pointer hover:opacity-90 transition-opacity" 
                />
              </>
            )}
            {currentUserRole === 'admin' && (
              <button 
                onClick={() => update({ cover_color: null, cover_image: null })} 
                className="absolute bottom-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 bg-black/60 hover:bg-black/80 text-white rounded-xl transition-all opacity-0 group-hover:opacity-100 z-20"
              >
                Remover capa
              </button>
            )}
          </div>
        )}

        <div className="p-6 md:p-8 space-y-6 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 flex items-center gap-3">
              {/* Botão de Check Circular no Modal */}
              <button
                onClick={async () => {
                  if (currentUserRole !== 'admin') return;
                  const nextDone = !taskData.is_done;
                  await update({ is_done: nextDone });
                }}
                className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                  taskData.is_done 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                    : 'bg-transparent border-white/20 hover:border-emerald-500/50'
                }`}
                title={taskData.is_done ? "Marcar como não concluído" : "Marcar como concluído"}
              >
                {taskData.is_done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              <div className="flex-1">
                <input type="text" value={cardTitle} onChange={e => setCardTitle(e.target.value)}
                  onBlur={() => update({ title: cardTitle })}
                  onKeyDown={e => { if (e.key === 'Enter') update({ title: cardTitle }); }}
                  readOnly={currentUserRole !== 'admin'}
                  className={`w-full bg-transparent border-b border-transparent ${currentUserRole === 'admin' ? 'focus:border-primary' : ''} text-2xl font-bold outline-none pb-1 transition-colors ${
                    taskData.is_done ? 'line-through text-muted-foreground/60' : 'text-white'
                  }`} 
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Botão de 3 pontinhos - apenas mobile */}
              {currentUserRole === 'admin' && (
                <button
                  onClick={() => setShowMobileActions(true)}
                  className="md:hidden p-1.5 bg-[#2c333a] hover:bg-[#38414a] text-muted-foreground hover:text-white rounded-xl transition-colors"
                  title="Ações"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 bg-[#2c333a] hover:bg-[#38414a] text-muted-foreground hover:text-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Grid de Conteúdo Principal & Sidebar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-0 overflow-hidden items-start">
            
            {/* Coluna Esquerda: Conteúdo Principal */}
            <div className={`${currentUserRole === 'admin' ? 'md:col-span-3' : 'md:col-span-4'} h-full overflow-y-auto pr-4 custom-scrollbar space-y-6`}>

              {/* Fileira de Badges (Membros, Etiquetas) */}
              {(taskData.assignees.length > 0 || taskData.labels.length > 0) && (
                <div className="flex flex-wrap gap-6 pb-2">
                  
                  {/* Membros / Responsáveis */}
                  {taskData.assignees.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Responsáveis</span>
                      <div className="flex flex-wrap gap-1 items-center">
                        {taskData.assignees.map(a => (
                          <div 
                            key={a.user_id} 
                            className={`w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${currentUserRole === 'admin' ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity`}
                            style={{ backgroundColor: avatarColor(a.user_id) }}
                            title={a.full_name}
                            onClick={() => { if (currentUserRole === 'admin') setActivePopover('members'); }}
                          >
                            {initials(a.full_name)}
                          </div>
                        ))}
                        {currentUserRole === 'admin' && (
                          <button 
                            onClick={() => setActivePopover('members')}
                            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white border border-dashed border-white/20 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Etiquetas */}
                  {taskData.labels.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Etiquetas</span>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {taskData.labels.map(l => (
                          <div 
                            key={l.id} 
                            className={`group px-2.5 py-1 rounded-xl text-[11px] font-bold text-black ${currentUserRole === 'admin' ? 'cursor-pointer hover:brightness-110' : ''} transition-all shadow-sm flex items-center gap-1.5`}
                            style={getLabelStyle(l)}
                            onClick={() => { if (currentUserRole === 'admin') setActivePopover('labels'); }}
                          >
                            <span>{l.text}</span>
                            {currentUserRole === 'admin' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveLabel(l.id);
                                }}
                                className="p-0.5 hover:bg-black/20 rounded-md transition-colors text-black/70 hover:text-black flex items-center justify-center"
                                title="Remover etiqueta"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {currentUserRole === 'admin' && (
                          <button 
                            onClick={() => setActivePopover('labels')}
                            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white border border-dashed border-white/20 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Descrição */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <AlignLeft className="w-4 h-4 text-muted-foreground" />
                    <span>Descrição</span>
                  </div>
                  {!isEditingDesc && taskData.description && currentUserRole === 'admin' && (
                    <button 
                      onClick={() => setIsEditingDesc(true)} 
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-xl text-xs font-semibold transition-all"
                    >
                      Editar
                    </button>
                  )}
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea 
                      ref={descTextareaRef}
                      value={cardDesc} 
                      onChange={e => setCardDesc(e.target.value)}
                      className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl p-3 text-sm text-white placeholder:text-muted-foreground outline-none resize-none" 
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setIsEditingDesc(false)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs transition-colors">Cancelar</button>
                      <button onClick={async () => { await update({ description: cardDesc }); setIsEditingDesc(false); }}
                        className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-semibold transition-colors">Salvar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div 
                      ref={descViewRef}
                      onClick={() => { if (currentUserRole === 'admin') setIsEditingDesc(true); }}
                      className={`relative p-4 bg-[#1d2125] hover:bg-[#1d2125]/80 rounded-xl border border-white/5 ${currentUserRole === 'admin' ? 'cursor-pointer' : ''} text-sm text-white/90 leading-relaxed transition-all whitespace-pre-wrap overflow-hidden ${
                        !isDescExpanded && showExpandButton ? 'max-h-[400px]' : ''
                      }`}
                    >
                      {taskData.description || (currentUserRole === 'admin' ? <span className="text-muted-foreground italic text-xs">Clique para adicionar uma descrição detalhada da tarefa...</span> : <span className="text-muted-foreground italic text-xs">Sem descrição.</span>)}
                      
                      {/* Gradiente de fade quando recolhido */}
                      {!isDescExpanded && showExpandButton && (
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1d2125] via-[#1d2125]/80 to-transparent pointer-events-none" />
                      )}
                    </div>

                    {showExpandButton && (
                      <button
                        onClick={() => setIsDescExpanded(!isDescExpanded)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-[#2c333a] hover:bg-[#38414a] text-xs font-semibold text-white rounded-xl transition-all border border-white/5 shadow-sm"
                      >
                        {isDescExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            <span>Mostrar menos</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            <span>Mostrar mais</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Checklist */}
              {showChecklist && (
                <div className="space-y-4 pt-2 border-t border-white/5" ref={checklistSectionRef}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-white font-bold text-sm min-w-0">
                      <CheckSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                      {isEditingChecklistTitle ? (
                        <input
                          autoFocus
                          type="text"
                          value={checklistTitle}
                          onChange={e => setChecklistTitle(e.target.value)}
                          onBlur={handleSaveChecklistTitle}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveChecklistTitle();
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setChecklistTitle(taskData.checklist_title || 'Checklist');
                              setIsEditingChecklistTitle(false);
                            }
                          }}
                          className="bg-transparent border-b border-primary text-white font-bold text-sm outline-none pb-0.5 min-w-0 w-auto"
                          style={{ width: `${Math.max(checklistTitle.length, 4)}ch` }}
                        />
                      ) : (
                        <span
                          onClick={() => { if (currentUserRole === 'admin') setIsEditingChecklistTitle(true); }}
                          className={`${currentUserRole === 'admin' ? 'cursor-pointer hover:text-white/70' : ''} transition-colors truncate`}
                          title={currentUserRole === 'admin' ? "Clique para renomear" : undefined}
                        >
                          {checklistTitle}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {totalChecklist > 0 && (
                        <button
                          onClick={() => setHideCheckedItems(!hideCheckedItems)}
                          className="px-3 py-1.5 bg-[#2c333a] hover:bg-[#38414a] text-[#c7d1db] hover:text-white rounded-lg text-xs font-semibold border border-white/5 transition-all"
                        >
                          {hideCheckedItems ? 'Mostrar itens marcados' : 'Ocultar itens marcados'}
                        </button>
                      )}
                      {currentUserRole === 'admin' && (
                        <button
                          onClick={handleDeleteEntireChecklist}
                          className="px-3 py-1.5 bg-[#2c333a] hover:bg-[#38414a] text-[#c7d1db] hover:text-white rounded-lg text-xs font-semibold border border-white/5 transition-all"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                  {totalChecklist > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground font-semibold shrink-0 w-8 text-right">{checklistPct}%</span>
                      <div className="flex-1 h-2 bg-white/15 rounded-full">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${checklistPct}%`, backgroundColor: checklistPct === 100 ? '#22c55e' : '#0079bf' }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {taskData.checklist
                      .filter(item => !hideCheckedItems || !item.done)
                      .map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-black/10 hover:bg-black/20 border border-white/5 rounded-xl group transition-all">
                        <div className="flex items-center gap-3 select-none flex-1 min-w-0">
                          {/* Checkbox independente */}
                          <div 
                            onClick={() => { if (currentUserRole === 'admin') handleToggleChecklist(item.id); }} 
                            className={`${currentUserRole === 'admin' ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity shrink-0`}
                          >
                            {item.done ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                          </div>

                          {/* Campo de texto / Input de edição */}
                          {editingItemId === item.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingItemText}
                              onChange={e => setEditingItemText(e.target.value)}
                              onBlur={() => handleSaveChecklistItemText(item.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveChecklistItemText(item.id);
                                if (e.key === 'Escape') setEditingItemId(null);
                              }}
                              className="flex-1 bg-[#1d2125] border border-primary/60 focus:border-primary rounded-lg px-2 py-1 text-sm text-white outline-none min-w-0"
                            />
                          ) : (
                            <span 
                              onClick={() => {
                                if (currentUserRole === 'admin') {
                                  setEditingItemId(item.id);
                                  setEditingItemText(item.text);
                                }
                              }}
                              className={`text-sm flex-1 ${currentUserRole === 'admin' ? 'cursor-text hover:text-white/80' : ''} truncate ${item.done ? 'line-through text-muted-foreground' : 'text-white'}`}
                            >
                              {item.text}
                            </span>
                          )}
                        </div>
                        {currentUserRole === 'admin' && (
                          <button onClick={() => handleDeleteChecklist(item.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {totalChecklist === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Sem subtarefas adicionadas.</p>}
                  </div>
                  {/* Input de adicionar item - estilo Trello */}
                  {currentUserRole === 'admin' && (
                    <div className="space-y-2">
                      {isAddingChecklistItem ? (
                        <div className="space-y-2">
                          <input
                            ref={checklistInputRef}
                            autoFocus
                            type="text"
                            placeholder="Adicionar um item"
                            value={newChecklistItem}
                            onChange={e => setNewChecklistItem(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { handleAddChecklist(); }
                              if (e.key === 'Escape') { setIsAddingChecklistItem(false); setNewChecklistItem(''); }
                            }}
                            className="w-full bg-[#1d2125] border border-primary/60 focus:border-primary rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none transition-all"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { handleAddChecklist(); }}
                              className="px-3 py-1.5 bg-[#0079bf] hover:bg-[#026aa7] text-white rounded-xl text-xs font-bold transition-colors"
                            >
                              Adicionar
                            </button>
                            <button
                              onClick={() => { setIsAddingChecklistItem(false); setNewChecklistItem(''); }}
                              className="px-3 py-1.5 text-muted-foreground hover:text-white text-xs font-medium transition-colors rounded-xl hover:bg-white/5"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingChecklistItem(true)}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-sm font-medium transition-all border border-white/5 hover:border-white/10"
                        >
                          Adicionar um item
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Anexos */}
              {(attachments.length > 0 || isUploading) && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Paperclip className="w-4 h-4 text-muted-foreground" /><span>Anexos</span>
                      {attachments.length > 0 && <span className="text-[10px] font-bold bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full">{attachments.length}</span>}
                    </div>
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-3 py-1.5 bg-[#2c333a] hover:bg-[#38414a] disabled:opacity-50 text-white rounded-xl text-xs font-semibold border border-white/5 transition-all"
                      >
                        Adicionar
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Skeleton de upload */}
                    {isUploading && (
                      <div className="flex items-center gap-3 p-3 bg-[#1d2125] border border-white/5 rounded-xl animate-pulse">
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">Enviando arquivo...</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 animate-pulse">Por favor, aguarde...</p>
                        </div>
                      </div>
                    )}

                    {attachments.map(att => {
                      const isImage = att.file_type.startsWith('image/');
                      return (
                        <div key={att.id} className="flex items-center gap-3 p-3 bg-black/10 hover:bg-black/20 border border-white/5 rounded-xl group transition-all">
                          <div
                            className={`w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center border border-white/5 relative group/thumb ${isImage ? 'cursor-pointer' : ''}`}
                            onClick={() => isImage && setLightboxUrl(att.file_url)}
                          >
                            {isImage ? (
                              <>
                                <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l5 5M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
                                  </svg>
                                </div>
                              </>
                            ) : att.file_type === 'application/pdf' ? (
                              <FileText className="w-6 h-6 text-red-400" />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate" title={att.file_name}>{att.file_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{formatSize(att.file_size)} · {timeAgo(att.created_at)}</span>
                              {taskData.cover_image === att.file_url && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-lg border border-emerald-500/20">
                                  <ImageIcon className="w-2.5 h-2.5" /> Capa
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {isImage && currentUserRole === 'admin' && (
                              <button
                                onClick={async () => {
                                  const isCurrentCover = taskData.cover_image === att.file_url;
                                  await update({
                                    cover_image: isCurrentCover ? null : att.file_url,
                                    cover_color: isCurrentCover ? null : null
                                  });
                                }}
                                className={`p-1.5 rounded-xl border transition-all ${
                                  taskData.cover_image === att.file_url
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'hover:bg-white/10 border-transparent text-muted-foreground hover:text-white'
                                }`}
                                title={taskData.cover_image === att.file_url ? "Remover capa" : "Tornar capa"}
                              >
                                <Palette className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-xl transition-colors" title="Baixar">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            {att.user_id === currentUserId && currentUserRole === 'admin' && (
                              <button onClick={() => handleDeleteAttachment(att)}
                                className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-colors" title="Remover">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comentários */}
              <div className="space-y-4 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Send className="w-4 h-4 text-muted-foreground" />
                  <span>Comentários</span>
                  {comments.length > 0 && <span className="text-[10px] font-bold bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full">{comments.length}</span>}
                </div>

                {/* Add comment */}
                <div className="flex gap-3 items-start">
                  {currentUserId && (
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                      style={{ backgroundColor: avatarColor(currentUserId) }}>
                      {initials(members.find(m => m.user_id === currentUserId)?.full_name || 'U')}
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <textarea rows={2} placeholder="Escreva um comentário..." value={commentText} onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                      className="w-full bg-[#1d2125] border border-white/5 focus:border-primary/50 rounded-xl p-3 text-sm text-white placeholder:text-muted-foreground outline-none resize-none transition-all" />
                    <div className="flex items-center gap-2">
                      <button onClick={handleAddComment} disabled={!commentText.trim() || isSendingComment}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all">
                        {isSendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Comentar
                      </button>
                      <span className="text-[10px] text-muted-foreground">Enter para enviar, Shift+Enter para nova linha</span>
                    </div>
                  </div>
                </div>

                {/* Lista de comentários */}
                {comments.length > 0 && (
                  <div className="space-y-3 pr-1">
                    {comments.map(comment => (
                      <div key={comment.id} className="flex gap-3 group">
                        <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                          style={{ backgroundColor: avatarColor(comment.user_id) }}>
                          {initials(comment.profiles?.full_name || 'U')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-bold text-white">{comment.profiles?.full_name || 'Usuário'}</span>
                            <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
                          </div>
                          <div className="p-3 bg-[#1d2125] border border-white/5 rounded-xl text-sm text-white/90 leading-relaxed">
                            {comment.content}
                          </div>
                          {comment.user_id === currentUserId && (
                            <button onClick={() => handleDeleteComment(comment.id)}
                              className="mt-1 text-[10px] text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                              Excluir comentário
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {comments.length === 0 && (
                  <p className="text-xs text-muted-foreground/40 italic text-center py-2">Nenhum comentário ainda. Seja o primeiro!</p>
                )}
              </div>

            </div>

            {/* Coluna Direita: Sidebar de Ações (Estilo Trello) - apenas desktop */}
            {currentUserRole === 'admin' && (
              <div className="hidden md:block md:col-span-1 space-y-4">
              
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Adicionar ao cartão</span>
                
                {/* Botão Membros */}
                <div className="relative" ref={membersPopoverRef}>
                  <button 
                    onClick={() => setActivePopover(activePopover === 'members' ? null : 'members')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-xs font-semibold border border-white/5 transition-all text-left relative"
                  >
                    <UserCheck className="w-4 h-4 text-muted-foreground" />
                    <span>Responsáveis</span>
                  </button>
                  <AnimatePresence>
                    {activePopover === 'members' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 z-50 w-72 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                           <span className="text-xs font-bold text-white">Membros do Projeto</span>
                          <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {members.map(m => {
                            const isAssigned = taskData.assignees.some(a => a.user_id === m.user_id);
                            return (
                              <button
                                key={m.user_id}
                                onClick={() => handleToggleAssignee(m)}
                                className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-white/5 transition-all"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: avatarColor(m.user_id) }}>
                                    {initials(m.full_name)}
                                  </div>
                                  <span className="text-xs text-white font-medium truncate max-w-[150px]">{m.full_name.replace(' (Dono)', '')}</span>
                                </div>
                                {isAssigned && <Check className="w-4 h-4 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                          {members.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Nenhum membro.</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Botão Etiquetas */}
                <div className="relative" ref={labelsPopoverRef}>
                  <button 
                    onClick={() => setActivePopover(activePopover === 'labels' ? null : 'labels')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-xs font-semibold border border-white/5 transition-all text-left relative"
                  >
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span>Etiquetas</span>
                  </button>
                  <AnimatePresence>
                    {activePopover === 'labels' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 z-50 w-72 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-4"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-xs font-bold text-white">Etiquetas</span>
                          <button onClick={() => { setActivePopover(null); setSearchLabelQuery(''); setShowCreateLabel(false); }} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>

                        {/* Input de busca */}
                        <input 
                          type="text" 
                          placeholder="Buscar etiquetas..." 
                          value={searchLabelQuery}
                          onChange={e => setSearchLabelQuery(e.target.value)}
                          className="w-full bg-[#1d2125] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all" 
                        />
                        
                        {/* Seção de Prioridades */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Etiquetas de Prioridade</span>
                          <div className="space-y-1.5">
                            {PRESET_LABELS.filter(p => p.text.toLowerCase().includes(searchLabelQuery.toLowerCase())).map(preset => {
                              const isSelected = taskData.labels.some(l => l.text.toLowerCase() === preset.text.toLowerCase());
                              return (
                                <div key={preset.text} className="flex items-center gap-2 group">
                                  {/* Checkbox */}
                                  <button
                                    onClick={() => handleTogglePresetLabel(preset)}
                                    className="w-4 h-4 rounded-md border border-white/20 bg-black/40 flex items-center justify-center cursor-pointer hover:border-primary shrink-0 transition-colors"
                                  >
                                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                                  </button>

                                  {/* Pílula colorida da prioridade */}
                                  <button
                                    onClick={() => handleTogglePresetLabel(preset)}
                                    style={getLabelStyle({ id: '', text: preset.text, color: preset.color })}
                                    className="flex-1 h-8 px-3 rounded-xl text-xs font-bold text-black text-left hover:brightness-110 active:scale-[0.98] transition-all flex items-center shadow-sm"
                                  >
                                    {preset.text}
                                  </button>

                                  {/* Lápis de edição */}
                                  <button
                                    onClick={() => {
                                      setNewLabelText(preset.text);
                                      setNewLabelColor(preset.color);
                                      setShowCreateLabel(true);
                                    }}
                                    className="p-1.5 hover:bg-white/5 text-muted-foreground hover:text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    title="Editar ou usar como base"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                            {PRESET_LABELS.filter(p => p.text.toLowerCase().includes(searchLabelQuery.toLowerCase())).length === 0 && (
                              <p className="text-[11px] text-muted-foreground italic py-1 text-center">Nenhuma prioridade correspondente.</p>
                            )}
                          </div>
                        </div>

                        {/* Outras Etiquetas (Customizadas) */}
                        {taskData.labels.filter(l => !PRESET_LABELS.some(p => p.text.toLowerCase() === l.text.toLowerCase())).filter(l => l.text.toLowerCase().includes(searchLabelQuery.toLowerCase())).length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-white/5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Etiquetas Personalizadas</span>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                              {taskData.labels
                                .filter(l => !PRESET_LABELS.some(p => p.text.toLowerCase() === l.text.toLowerCase()))
                                .filter(l => l.text.toLowerCase().includes(searchLabelQuery.toLowerCase()))
                                .map(label => (
                                  <div key={label.id} className="flex items-center gap-2 group">
                                    <button
                                      onClick={() => handleRemoveLabel(label.id)}
                                      className="w-4 h-4 rounded-md border border-white/20 bg-black/40 flex items-center justify-center cursor-pointer hover:border-primary shrink-0 transition-colors"
                                    >
                                      <Check className="w-3 h-3 text-primary" />
                                    </button>

                                    <div
                                      style={getLabelStyle(label)}
                                      className="flex-1 h-8 px-3 rounded-xl text-xs font-bold text-black flex items-center shadow-sm"
                                    >
                                      {label.text}
                                    </div>

                                    <button
                                      onClick={() => handleRemoveLabel(label.id)}
                                      className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-red-400 rounded-xl transition-all shrink-0"
                                      title="Remover"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Ações */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <button
                            onClick={() => setShowCreateLabel(!showCreateLabel)}
                            className="w-full py-2 bg-[#2c333a] hover:bg-[#38414a] text-white border border-white/5 rounded-xl transition-all"
                          >
                            {showCreateLabel ? 'Ocultar criação' : 'Criar uma nova etiqueta'}
                          </button>

                          {showCreateLabel && (
                            <div className="space-y-2.5 pt-2 border-t border-white/5 overflow-hidden">
                              <input 
                                type="text" 
                                placeholder="Nome da etiqueta..." 
                                value={newLabelText} 
                                onChange={e => setNewLabelText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLabel(); } }}
                                className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-muted-foreground outline-none transition-all" 
                              />
                              <div className="grid grid-cols-4 gap-1.5">
                                {LABEL_COLORS.map(c => (
                                  <button 
                                    key={c.value} 
                                    onClick={() => setNewLabelColor(c.value)}
                                    className={`w-full h-6 rounded-lg transition-all ${newLabelColor === c.value ? 'ring-2 ring-white scale-110' : ''}`}
                                    style={{ backgroundColor: c.value }} 
                                  />
                                ))}
                              </div>
                              <button 
                                onClick={handleAddLabel} 
                                className="w-full py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-colors"
                              >
                                Criar e Adicionar
                              </button>
                            </div>
                          )}

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Botão Checklist - Popover estilo Trello */}
                <div className="relative" ref={checklistPopoverRef}>
                  <button
                    onClick={() => setActivePopover(activePopover === 'checklist' ? null : 'checklist')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-xs font-semibold border border-white/5 transition-all text-left"
                  >
                    <CheckSquare className="w-4 h-4 text-muted-foreground" />
                    <span>Checklist</span>
                  </button>
                  <AnimatePresence>
                    {activePopover === 'checklist' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 z-50 w-72 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-4"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-xs font-bold text-white">Adicionar Checklist</span>
                          <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Título</label>
                          <input
                            type="text"
                            value={checklistTitle}
                            onChange={e => setChecklistTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateChecklist();
                              }
                            }}
                            autoFocus
                            className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted-foreground outline-none transition-all"
                          />
                        </div>
                        <button
                          onClick={handleCreateChecklist}
                          className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Adicionar
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>



                {/* Botão Anexos */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center gap-2.5 px-3 py-2 bg-[#2c333a] hover:bg-[#38414a] disabled:opacity-50 text-white rounded-xl text-xs font-semibold border border-white/5 transition-all text-left"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Paperclip className="w-4 h-4 text-muted-foreground" />}
                  <span>{isUploading ? 'Enviando...' : 'Anexos'}</span>
                </button>

                {/* Botão Capa */}
                <div className="relative" ref={coverPopoverRef}>
                  <button 
                    onClick={() => setActivePopover(activePopover === 'cover' ? null : 'cover')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-xs font-semibold border border-white/5 transition-all text-left relative"
                  >
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <span>Capa</span>
                  </button>
                  <AnimatePresence>
                    {activePopover === 'cover' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 z-50 w-72 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-xs font-bold text-white">Escolha a Cor da Capa</span>
                          <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {COVER_COLORS.map(color => (
                            <button 
                              key={color} 
                              onClick={() => update({ cover_color: color, cover_image: null })}
                              className={`w-full h-8 rounded-xl transition-all hover:scale-105 ${taskData.cover_color === color ? 'ring-2 ring-white scale-105' : ''}`}
                              style={{ backgroundColor: color }} 
                            />
                          ))}
                        </div>
                        {(taskData.cover_color || taskData.cover_image) && (
                          <button 
                            onClick={() => update({ cover_color: null, cover_image: null })}
                            className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white rounded-xl text-xs font-bold transition-all"
                          >
                            Remover Capa
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Ações</span>
                
                {/* Botão Mover */}
                <div className="relative" ref={movePopoverRef}>
                  <button 
                    onClick={() => setActivePopover(activePopover === 'move' ? null : 'move')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-xs font-semibold border border-white/5 transition-all text-left relative"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                    <span>Mover</span>
                  </button>
                  <AnimatePresence>
                    {activePopover === 'move' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 z-50 w-72 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-xs font-bold text-white">Mover para Lista</span>
                          <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {columns.filter(c => c.id !== colId).map(col => (
                            <button 
                              key={col.id} 
                              onClick={() => { onMoveTask(col.id); setActivePopover(null); }}
                              className="w-full text-left p-2.5 bg-[#2c333a] hover:bg-primary/20 hover:text-white border border-white/5 hover:border-primary/30 text-xs text-muted-foreground rounded-xl font-medium transition-all"
                            >
                              {col.title}
                            </button>
                          ))}
                          {columns.filter(c => c.id !== colId).length === 0 && (
                            <p className="text-xs text-muted-foreground italic text-center py-2">Nenhuma outra lista.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              {/* Botão Excluir */}
              <button 
                onClick={() => onDeleteTask(task.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-xs font-semibold border border-red-500/20 hover:border-red-500/30 transition-all text-left"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Card</span>
              </button>

            </div>

          </div>
          )}

          </div>

        </div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

        {/* Bottom Sheet Mobile - Ações */}
        <AnimatePresence>
          {showMobileActions && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[150] bg-black/60 md:hidden"
                onClick={() => setShowMobileActions(false)}
              />
              {/* Sheet */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[160] md:hidden bg-[#22272b] border-t border-white/10 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>

                <div className="px-5 pb-8 space-y-5">
                  {/* Título */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Ações do cartão</span>
                    <button
                      onClick={() => setShowMobileActions(false)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-xl transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Adicionar ao cartão */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Adicionar ao cartão</span>

                    {/* Responsáveis */}
                    <div className="relative" ref={membersPopoverRef}>
                      <button
                        onClick={() => setActivePopover(activePopover === 'members' ? null : 'members')}
                        className="w-full flex items-center gap-2.5 px-3 py-3 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-sm font-semibold border border-white/5 transition-all text-left"
                      >
                        <UserCheck className="w-4 h-4 text-muted-foreground" />
                        <span>Responsáveis</span>
                      </button>
                      <AnimatePresence>
                        {activePopover === 'members' && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mt-2 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                              <span className="text-xs font-bold text-white">Membros do Projeto</span>
                              <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {members.map(m => {
                                const isAssigned = taskData.assignees.some(a => a.user_id === m.user_id);
                                return (
                                  <button
                                    key={m.user_id}
                                    onClick={() => handleToggleAssignee(m)}
                                    className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-white/5 transition-all"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: avatarColor(m.user_id) }}>
                                        {initials(m.full_name)}
                                      </div>
                                      <span className="text-xs text-white font-medium">{m.full_name.replace(' (Dono)', '')}</span>
                                    </div>
                                    {isAssigned && <Check className="w-4 h-4 text-primary shrink-0" />}
                                  </button>
                                );
                              })}
                              {members.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Nenhum membro.</p>}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Etiquetas */}
                    <div className="relative" ref={labelsPopoverRef}>
                      <button
                        onClick={() => setActivePopover(activePopover === 'labels' ? null : 'labels')}
                        className="w-full flex items-center gap-2.5 px-3 py-3 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-sm font-semibold border border-white/5 transition-all text-left"
                      >
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        <span>Etiquetas</span>
                      </button>
                      <AnimatePresence>
                        {activePopover === 'labels' && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mt-2 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-4"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                              <span className="text-xs font-bold text-white">Etiquetas</span>
                              <button onClick={() => { setActivePopover(null); setSearchLabelQuery(''); setShowCreateLabel(false); }} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder="Buscar etiquetas..."
                              value={searchLabelQuery}
                              onChange={e => setSearchLabelQuery(e.target.value)}
                              className="w-full bg-[#1d2125] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:border-primary/50 outline-none transition-all"
                            />
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Etiquetas de Prioridade</span>
                              {PRESET_LABELS.filter(p => p.text.toLowerCase().includes(searchLabelQuery.toLowerCase())).map(preset => {
                                const isSelected = taskData.labels.some(l => l.text.toLowerCase() === preset.text.toLowerCase());
                                return (
                                  <div key={preset.text} className="flex items-center gap-2">
                                    <button onClick={() => handleTogglePresetLabel(preset)} className="w-4 h-4 rounded-md border border-white/20 bg-black/40 flex items-center justify-center shrink-0">
                                      {isSelected && <Check className="w-3 h-3 text-primary" />}
                                    </button>
                                    <button onClick={() => handleTogglePresetLabel(preset)} style={{ backgroundColor: preset.color }} className="flex-1 h-8 px-3 rounded-xl text-xs font-bold text-black text-left flex items-center">
                                      {preset.text}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            <button onClick={() => setShowCreateLabel(!showCreateLabel)} className="w-full py-2 bg-[#2c333a] hover:bg-[#38414a] text-white border border-white/5 rounded-xl text-xs transition-all">
                              {showCreateLabel ? 'Ocultar criação' : 'Criar uma nova etiqueta'}
                            </button>
                            {showCreateLabel && (
                              <div className="space-y-2.5 pt-2 border-t border-white/5">
                                <input type="text" placeholder="Nome da etiqueta..." value={newLabelText} onChange={e => setNewLabelText(e.target.value)}
                                  className="w-full bg-[#1d2125] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-muted-foreground outline-none transition-all" />
                                <div className="grid grid-cols-4 gap-1.5">
                                  {LABEL_COLORS.map(c => (
                                    <button key={c.value} onClick={() => setNewLabelColor(c.value)}
                                      className={`w-full h-6 rounded-lg transition-all ${newLabelColor === c.value ? 'ring-2 ring-white scale-110' : ''}`}
                                      style={{ backgroundColor: c.value }} />
                                  ))}
                                </div>
                                <button onClick={handleAddLabel} className="w-full py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-colors">Criar e Adicionar</button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Checklist - popover inline no mobile */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setActivePopover(activePopover === 'checklist' ? null : 'checklist')}
                        className="w-full flex items-center gap-2.5 px-3 py-3 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-sm font-semibold border border-white/5 transition-all text-left"
                      >
                        <CheckSquare className="w-4 h-4 text-muted-foreground" />
                        <span>Checklist</span>
                      </button>
                      <AnimatePresence>
                        {activePopover === 'checklist' && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="bg-[#2c333a] border border-white/10 rounded-2xl p-4 space-y-4"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                              <span className="text-xs font-bold text-white">Adicionar Checklist</span>
                              <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Título</label>
                              <input
                                type="text"
                                value={checklistTitle}
                                onChange={e => setChecklistTitle(e.target.value)}
                                autoFocus
                                className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-3 py-2 text-sm text-white outline-none transition-all"
                              />
                            </div>
                            <button
                              onClick={() => {
                                setShowChecklist(true);
                                setActivePopover(null);
                                setShowMobileActions(false);
                                setTimeout(() => checklistSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
                              }}
                              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors"
                            >
                              Adicionar
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Anexos */}
                    <button
                      onClick={() => { fileInputRef.current?.click(); setShowMobileActions(false); }}
                      disabled={isUploading}
                      className="w-full flex items-center gap-2.5 px-3 py-3 bg-[#2c333a] hover:bg-[#38414a] disabled:opacity-50 text-white rounded-xl text-sm font-semibold border border-white/5 transition-all text-left"
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Paperclip className="w-4 h-4 text-muted-foreground" />}
                      <span>{isUploading ? 'Enviando...' : 'Anexos'}</span>
                    </button>

                    {/* Capa */}
                    <div className="relative" ref={coverPopoverRef}>
                      <button
                        onClick={() => setActivePopover(activePopover === 'cover' ? null : 'cover')}
                        className="w-full flex items-center gap-2.5 px-3 py-3 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-sm font-semibold border border-white/5 transition-all text-left"
                      >
                        <Palette className="w-4 h-4 text-muted-foreground" />
                        <span>Capa</span>
                      </button>
                      <AnimatePresence>
                        {activePopover === 'cover' && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mt-2 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                              <span className="text-xs font-bold text-white">Cor da Capa</span>
                              <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {COVER_COLORS.map(color => (
                                <button key={color} onClick={() => update({ cover_color: color })}
                                  className={`w-full h-10 rounded-xl transition-all hover:scale-105 ${taskData.cover_color === color ? 'ring-2 ring-white scale-105' : ''}`}
                                  style={{ backgroundColor: color }} />
                              ))}
                            </div>
                            {taskData.cover_color && (
                              <button onClick={() => update({ cover_color: null })} className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white rounded-xl text-xs font-bold transition-all">Remover Capa</button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Ações</span>

                    {/* Mover */}
                    <div className="relative" ref={movePopoverRef}>
                      <button
                        onClick={() => setActivePopover(activePopover === 'move' ? null : 'move')}
                        className="w-full flex items-center gap-2.5 px-3 py-3 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-sm font-semibold border border-white/5 transition-all text-left"
                      >
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                        <span>Mover</span>
                      </button>
                      <AnimatePresence>
                        {activePopover === 'move' && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mt-2 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                              <span className="text-xs font-bold text-white">Mover para Lista</span>
                              <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                            </div>
                            <div className="space-y-1.5">
                              {columns.filter(c => c.id !== colId).map(col => (
                                <button key={col.id} onClick={() => { onMoveTask(col.id); setActivePopover(null); setShowMobileActions(false); }}
                                  className="w-full text-left p-2.5 bg-[#2c333a] hover:bg-primary/20 hover:text-white border border-white/5 hover:border-primary/30 text-xs text-muted-foreground rounded-xl font-medium transition-all">
                                  {col.title}
                                </button>
                              ))}
                              {columns.filter(c => c.id !== colId).length === 0 && (
                                <p className="text-xs text-muted-foreground italic text-center py-2">Nenhuma outra lista.</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Excluir */}
                    <button
                      onClick={() => { onDeleteTask(task.id); setShowMobileActions(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-sm font-semibold border border-red-500/20 hover:border-red-500/30 transition-all text-left"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir Card</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );

  // Lightbox renderizado em portal separado
  const lightboxPortal = lightboxUrl ? createPortal(
    <AnimatePresence>
      <motion.div
        key="lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        onClick={() => setLightboxUrl(null)}
        onKeyDown={(e) => { if (e.key === 'Escape') setLightboxUrl(null); }}
        tabIndex={-1}
      >
        <motion.img
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          src={lightboxUrl}
          alt="Visualização do anexo"
          className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
          onClick={e => e.stopPropagation()}
        />
        <button
          onClick={() => setLightboxUrl(null)}
          className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <>
      {modalPortal}
      {lightboxPortal}
    </>
  );
};

export default CardModal;
