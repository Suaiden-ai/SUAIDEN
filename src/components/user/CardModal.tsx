import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabase';
import {
  X, Check, CheckSquare, Square, AlignLeft, Calendar, Tag,
  ArrowRightLeft, UserCheck, Trash2, Plus, Palette, Send,
  Paperclip, Download, FileText, Image as ImageIcon, Loader2,
  Clock, Edit2
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
  { text: 'Baixa', color: '#22c55e' },
  { text: 'Média', color: '#eab308' },
  { text: 'Alta', color: '#ef4444' },
];

const COVER_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#06b6d4','#3b82f6','#8b5cf6','#ec4899',
  '#64748b','#1e3a5f','#166534','#7c2d12',
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
  task, colId, columns, members, currentUserId,
  onClose, onUpdateTask, onDeleteTask, onMoveTask
}) => {
  const [taskData, setTaskData] = useState<Task>(task);

  // Campos editáveis
  const [cardTitle, setCardTitle] = useState(task.title);
  const [cardDesc, setCardDesc] = useState(task.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showChecklist, setShowChecklist] = useState(task.checklist && task.checklist.length > 0);
  
  // Popovers (Trello-like)
  const [activePopover, setActivePopover] = useState<'members' | 'labels' | 'due_date' | 'cover' | 'move' | null>(null);
  
  const membersPopoverRef = useRef<HTMLDivElement>(null);
  const labelsPopoverRef = useRef<HTMLDivElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const coverPopoverRef = useRef<HTMLDivElement>(null);
  const movePopoverRef = useRef<HTMLDivElement>(null);
  const checklistSectionRef = useRef<HTMLDivElement>(null);

  const [newLabelText, setNewLabelText] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].value);
  const [dueDateInput, setDueDateInput] = useState(task.due_date ? task.due_date.slice(0, 10) : '');
  const [searchLabelQuery, setSearchLabelQuery] = useState('');
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState(false);

  // Comentários
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Anexos
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Carregar comentários e anexos ──
  const fetchExtras = async () => {
    const [{ data: commentsData }, { data: attachmentsData }] = await Promise.all([
      supabase.from('card_comments').select('*, profiles:user_id (full_name)').eq('task_id', task.id).order('created_at', { ascending: true }),
      supabase.from('card_attachments').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
    ]);
    if (commentsData) setComments(commentsData);
    if (attachmentsData) setAttachments(attachmentsData);
  };

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
      };
      
      const activeRef = refs[activePopover];
      if (activeRef?.current && !activeRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutsidePopovers);
    return () => document.removeEventListener('mousedown', handleClickOutsidePopovers);
  }, [activePopover]);

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
  };
  const handleToggleChecklist = async (id: string) =>
    update({ checklist: taskData.checklist.map(i => i.id === id ? { ...i, done: !i.done } : i) });
  const handleDeleteChecklist = async (id: string) =>
    update({ checklist: taskData.checklist.filter(i => i.id !== id) });

  // ── Labels ──
  const getLabelStyle = (label: Label) => {
    if (!colorBlindMode) return { backgroundColor: label.color };
    const textLower = label.text.toLowerCase();
    if (textLower === 'baixa') {
      return { backgroundImage: 'repeating-linear-gradient(45deg, #22c55e, #22c55e 6px, #15803d 6px, #15803d 12px)' };
    }
    if (textLower === 'média' || textLower === 'media') {
      return { backgroundImage: 'repeating-linear-gradient(-45deg, #eab308, #eab308 6px, #a16207 6px, #a16207 12px)' };
    }
    if (textLower === 'alta' || textLower === 'prioridade') {
      return { backgroundImage: 'repeating-linear-gradient(90deg, #ef4444, #ef4444 6px, #b91c1c 6px, #b91c1c 12px)' };
    }
    return { 
      backgroundImage: `repeating-linear-gradient(45deg, ${label.color}, ${label.color} 8px, rgba(0,0,0,0.15) 8px, rgba(0,0,0,0.15) 16px)`,
      backgroundColor: label.color
    };
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

  // ── Due Date ──
  const handleSaveDueDate = async () =>
    update({ due_date: dueDateInput ? new Date(dueDateInput).toISOString() : null });

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
      await supabase.from('card_comments').insert({ task_id: task.id, user_id: currentUserId, content: commentText.trim() });
      setCommentText('');
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('card_comments').delete().eq('id', commentId);
  };

  // ── Anexos ──
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    setIsUploading(true);
    try {
      const filePath = `${task.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('card-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('card-attachments').getPublicUrl(filePath);
      await supabase.from('card_attachments').insert({
        task_id: task.id, user_id: currentUserId,
        file_name: file.name, file_url: publicUrl,
        file_size: file.size, file_type: file.type,
      });
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    try {
      const filePath = attachment.file_url.split('/card-attachments/')[1];
      await supabase.storage.from('card-attachments').remove([filePath]);
      await supabase.from('card_attachments').delete().eq('id', attachment.id);
    } catch (err) {
      console.error('Erro ao remover anexo:', err);
    }
  };

  // ── Render ──
  const totalChecklist = taskData.checklist.length;
  const doneChecklist = taskData.checklist.filter(i => i.done).length;
  const checklistPct = totalChecklist > 0 ? Math.round((doneChecklist / totalChecklist) * 100) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-16 pb-12" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-5xl bg-[#22272b] border border-white/10 rounded-2xl shadow-2xl my-4">

        {/* Capa */}
        {taskData.cover_color && (
          <div className="h-28 w-full rounded-t-2xl relative transition-all" style={{ backgroundColor: taskData.cover_color }}>
            <button onClick={() => update({ cover_color: null })} className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="p-6 md:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 flex items-center gap-3">
              {/* Botão de Check Circular no Modal */}
              <button
                onClick={async () => {
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
                  className={`w-full bg-transparent border-b border-transparent focus:border-primary text-2xl font-bold outline-none pb-1 transition-colors ${
                    taskData.is_done ? 'line-through text-muted-foreground/60' : 'text-white'
                  }`} 
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  na lista <span className="text-white underline font-semibold">{columns.find(c => c.id === colId)?.title}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 bg-[#2c333a] hover:bg-[#38414a] text-muted-foreground hover:text-white rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grid de Conteúdo Principal & Sidebar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            
            {/* Coluna Esquerda: Conteúdo Principal */}
            <div className="md:col-span-3 space-y-6">

              {/* Fileira de Badges (Membros, Etiquetas, Vencimento) */}
              {(taskData.assignees.length > 0 || taskData.labels.length > 0 || taskData.due_date) && (
                <div className="flex flex-wrap gap-6 pb-2">
                  
                  {/* Membros / Responsáveis */}
                  {taskData.assignees.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Responsáveis</span>
                      <div className="flex flex-wrap gap-1 items-center">
                        {taskData.assignees.map(a => (
                          <div 
                            key={a.user_id} 
                            className="w-7 h-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" 
                            style={{ backgroundColor: avatarColor(a.user_id) }}
                            title={a.full_name}
                            onClick={() => setActivePopover('members')}
                          >
                            {initials(a.full_name)}
                          </div>
                        ))}
                        <button 
                          onClick={() => setActivePopover('members')}
                          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white border border-dashed border-white/20 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
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
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-black cursor-pointer hover:brightness-110 transition-all shadow-sm" 
                            style={getLabelStyle(l)}
                            onClick={() => setActivePopover('labels')}
                          >
                            {l.text}
                          </div>
                        ))}
                        <button 
                          onClick={() => setActivePopover('labels')}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white border border-dashed border-white/20 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Data de Vencimento */}
                  {taskData.due_date && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Data de Vencimento</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setActivePopover('due_date')}
                          className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                            formatDueDate(taskData.due_date)?.status === 'overdue' 
                              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
                              : formatDueDate(taskData.due_date)?.status === 'soon' 
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20' 
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDueDate(taskData.due_date)?.text}</span>
                          {formatDueDate(taskData.due_date)?.status === 'overdue' && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-red-500 text-white rounded-md">Atrasado</span>}
                          {formatDueDate(taskData.due_date)?.status === 'soon' && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-yellow-500 text-black rounded-md">Próximo</span>}
                        </button>
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
                  {!isEditingDesc && taskData.description && (
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
                    <textarea rows={4} value={cardDesc} onChange={e => setCardDesc(e.target.value)}
                      className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl p-3 text-sm text-white placeholder:text-muted-foreground outline-none resize-none transition-all" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setIsEditingDesc(false)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs transition-colors">Cancelar</button>
                      <button onClick={async () => { await update({ description: cardDesc }); setIsEditingDesc(false); }}
                        className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-semibold transition-colors">Salvar</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setIsEditingDesc(true)}
                    className="p-4 bg-[#1d2125] hover:bg-[#1d2125]/80 rounded-xl border border-white/5 cursor-pointer text-sm text-white/90 leading-relaxed min-h-[80px] transition-all">
                    {taskData.description || <span className="text-muted-foreground italic text-xs">Clique para adicionar uma descrição detalhada da tarefa...</span>}
                  </div>
                )}
              </div>

              {/* Checklist */}
              {showChecklist && (
                <div className="space-y-4 pt-2 border-t border-white/5" ref={checklistSectionRef}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white font-bold text-sm"><CheckSquare className="w-4 h-4 text-muted-foreground" /><span>Checklist</span></div>
                    {totalChecklist > 0 && <span className="text-xs text-muted-foreground">{doneChecklist} de {totalChecklist}</span>}
                  </div>
                  {totalChecklist > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground font-bold"><span>Progresso</span><span>{checklistPct}%</span></div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${checklistPct}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {taskData.checklist.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-black/10 hover:bg-black/20 border border-white/5 rounded-xl group transition-all">
                        <div onClick={() => handleToggleChecklist(item.id)} className="flex items-center gap-3 cursor-pointer select-none flex-1">
                          {item.done ? <CheckSquare className="w-5 h-5 text-primary shrink-0" /> : <Square className="w-5 h-5 text-muted-foreground shrink-0" />}
                          <span className={`text-sm ${item.done ? 'line-through text-muted-foreground' : 'text-white'}`}>{item.text}</span>
                        </div>
                        <button onClick={() => handleDeleteChecklist(item.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {totalChecklist === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Sem subtarefas adicionadas.</p>}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Adicionar item ao checklist..." value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddChecklist(); }}
                      className="flex-1 bg-[#1d2125] border border-white/5 focus:border-primary/50 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground outline-none transition-all" />
                    <button onClick={handleAddChecklist} className="px-4 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold transition-colors">Adicionar</button>
                  </div>
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
                          <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center border border-white/5">
                            {isImage ? (
                              <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" />
                            ) : att.file_type === 'application/pdf' ? (
                              <FileText className="w-6 h-6 text-red-400" />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate" title={att.file_name}>{att.file_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(att.file_size)} · {timeAgo(att.created_at)}</p>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-xl transition-colors" title="Baixar">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            {att.user_id === currentUserId && (
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
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
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

            {/* Coluna Direita: Sidebar de Ações (Estilo Trello) */}
            <div className="md:col-span-1 space-y-4">
              
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
                           <span className="text-xs font-bold text-white">Membros do Quadro</span>
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
                                      className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-red-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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

                          <button
                            onClick={() => setColorBlindMode(!colorBlindMode)}
                            className="w-full py-2 bg-[#2c333a] hover:bg-[#38414a] text-white border border-white/5 rounded-xl transition-all"
                          >
                            {colorBlindMode ? 'Desabilitar modo daltonismo' : 'Habilitar modo para daltônicos'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Botão Checklist */}
                <button 
                  onClick={() => {
                    const nextShow = !showChecklist;
                    setShowChecklist(nextShow);
                    if (nextShow) {
                      setTimeout(() => {
                        checklistSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-white rounded-xl text-xs font-semibold border transition-all text-left ${
                    showChecklist 
                      ? 'bg-primary/20 border-primary/30 hover:bg-primary/30' 
                      : 'bg-[#2c333a] border-white/5 hover:bg-[#38414a]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="w-4 h-4 text-muted-foreground" />
                    <span>Checklist</span>
                  </div>
                  {showChecklist && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>

                {/* Botão Datas */}
                <div className="relative" ref={datePopoverRef}>
                  <button 
                    onClick={() => setActivePopover(activePopover === 'due_date' ? null : 'due_date')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-xs font-semibold border border-white/5 transition-all text-left relative"
                  >
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Datas</span>
                  </button>
                  <AnimatePresence>
                    {activePopover === 'due_date' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 z-50 w-72 bg-[#2c333a] border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="text-xs font-bold text-white">Data de Vencimento</span>
                          <button onClick={() => setActivePopover(null)} className="p-0.5 hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <input 
                          type="date" 
                          value={dueDateInput} 
                          onChange={e => setDueDateInput(e.target.value)}
                          className="w-full bg-[#1d2125] border border-white/10 focus:border-primary/50 rounded-xl px-3 py-2 text-xs text-white outline-none [color-scheme:dark] transition-all" 
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { handleSaveDueDate(); setActivePopover(null); }} 
                            className="flex-1 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-colors"
                          >
                            Salvar
                          </button>
                          {taskData.due_date && (
                            <button 
                              onClick={() => { setDueDateInput(''); update({ due_date: null }); setActivePopover(null); }} 
                              className="px-3 py-1.5 bg-white/5 hover:bg-destructive/10 border border-white/10 text-muted-foreground hover:text-red-400 rounded-xl text-xs font-bold transition-colors"
                            >
                              Remover
                            </button>
                          )}
                        </div>
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
                              onClick={() => update({ cover_color: color })}
                              className={`w-full h-8 rounded-xl transition-all hover:scale-105 ${taskData.cover_color === color ? 'ring-2 ring-white scale-105' : ''}`}
                              style={{ backgroundColor: color }} 
                            />
                          ))}
                        </div>
                        {taskData.cover_color && (
                          <button 
                            onClick={() => update({ cover_color: null })}
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

              {/* Botão Fechar Modal */}
              <div className="pt-2 border-t border-white/5">
                <button 
                  onClick={onClose} 
                  className="w-full py-2 bg-[#2c333a] hover:bg-[#38414a] text-white rounded-xl text-xs font-bold transition-all text-center"
                >
                  Fechar Janela
                </button>
              </div>

            </div>

          </div>

        </div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </motion.div>
    </div>,
    document.body
  );
};

export default CardModal;
