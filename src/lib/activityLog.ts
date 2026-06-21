import { supabase } from '../services/supabase';

// ============================================================
// Sistema de logs do projeto (activity_log)
// Helper centralizado para registrar e consultar atividades de
// um quadro (board). Ver migration 0006_activity_log.sql.
// ============================================================

export type ActivityEntityType =
  | 'card'
  | 'comment'
  | 'attachment'
  | 'column'
  | 'member'
  | 'board';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'moved'
  | 'completed'
  | 'reopened'
  | 'commented'
  | 'comment_deleted'
  | 'uploaded'
  | 'attachment_deleted'
  | 'renamed'
  | 'assigned'
  | 'unassigned'
  | 'member_added'
  | 'member_removed'
  | 'archived'
  | 'restored';

export interface ActivityLogRow {
  id: string;
  board_id: string;
  task_id: string | null;
  column_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  entity_type: ActivityEntityType;
  action: ActivityAction;
  entity_label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LogActivityInput {
  boardId: string;
  entityType: ActivityEntityType;
  action: ActivityAction;
  actorId?: string | null;
  actorName?: string | null;
  taskId?: string | null;
  columnId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registra uma atividade no log do projeto.
 * Nunca lança: falhas de log não devem bloquear o fluxo do usuário.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const { error } = await supabase.from('activity_log').insert({
      board_id: input.boardId,
      entity_type: input.entityType,
      action: input.action,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
      task_id: input.taskId ?? null,
      column_id: input.columnId ?? null,
      entity_label: input.entityLabel ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) console.error('[activityLog] erro ao registrar:', error.message);
  } catch (err) {
    console.error('[activityLog] exceção ao registrar:', err);
  }
}

// ── Apresentação (labels / ícones / cores por evento) ──

export type ActivityKey = `${ActivityEntityType}:${ActivityAction}`;

interface ActivityMeta {
  /** rótulo curto da ação (ex.: "Criou um card") */
  label: string;
  /** nome do ícone lucide-react (ver getActivityIcon no componente) */
  icon: string;
  /** cor de destaque (tailwind text-*) */
  color: string;
}

const ACTIVITY_META: Record<string, ActivityMeta> = {
  'card:created':            { label: 'Criou um card',           icon: 'PlusSquare',   color: 'text-emerald-400' },
  'card:updated':           { label: 'Editou um card',           icon: 'Pencil',       color: 'text-blue-400' },
  'card:renamed':           { label: 'Renomeou um card',         icon: 'Type',         color: 'text-blue-400' },
  'card:deleted':           { label: 'Excluiu um card',          icon: 'Trash2',       color: 'text-red-400' },
  'card:moved':             { label: 'Moveu um card',            icon: 'ArrowRightLeft', color: 'text-amber-400' },
  'card:completed':         { label: 'Concluiu um card',         icon: 'CheckCircle2', color: 'text-emerald-400' },
  'card:reopened':          { label: 'Reabriu um card',          icon: 'RotateCcw',    color: 'text-amber-400' },
  'card:assigned':          { label: 'Atribuiu um responsável',  icon: 'UserPlus',     color: 'text-violet-400' },
  'card:unassigned':        { label: 'Removeu um responsável',   icon: 'UserMinus',    color: 'text-violet-400' },
  'card:archived':          { label: 'Arquivou um card',         icon: 'Archive',      color: 'text-zinc-400' },
  'card:restored':          { label: 'Restaurou um card',        icon: 'ArchiveRestore', color: 'text-zinc-400' },

  'comment:commented':      { label: 'Comentou',                 icon: 'MessageSquare', color: 'text-sky-400' },
  'comment:comment_deleted':{ label: 'Excluiu um comentário',    icon: 'MessageSquareX', color: 'text-red-400' },

  'attachment:uploaded':    { label: 'Anexou um arquivo',        icon: 'Paperclip',    color: 'text-cyan-400' },
  'attachment:attachment_deleted': { label: 'Removeu um anexo',  icon: 'FileX',        color: 'text-red-400' },

  'column:created':         { label: 'Criou uma coluna',         icon: 'Columns3',     color: 'text-emerald-400' },
  'column:renamed':         { label: 'Renomeou uma coluna',      icon: 'Type',         color: 'text-blue-400' },
  'column:deleted':         { label: 'Excluiu uma coluna',       icon: 'Trash2',       color: 'text-red-400' },

  'member:member_added':    { label: 'Adicionou um membro',      icon: 'UserPlus',     color: 'text-violet-400' },
  'member:member_removed':  { label: 'Removeu um membro',        icon: 'UserMinus',    color: 'text-red-400' },

  'board:updated':          { label: 'Atualizou o projeto',      icon: 'Settings2',    color: 'text-blue-400' },
  'board:renamed':          { label: 'Renomeou o projeto',       icon: 'Type',         color: 'text-blue-400' },
};

const DEFAULT_META: ActivityMeta = { label: 'Atividade', icon: 'Activity', color: 'text-zinc-400' };

export function getActivityMeta(row: Pick<ActivityLogRow, 'entity_type' | 'action'>): ActivityMeta {
  return ACTIVITY_META[`${row.entity_type}:${row.action}`] ?? DEFAULT_META;
}

/** Lista de filtros agrupados por categoria, para a UI da página de logs. */
export const ACTIVITY_FILTER_GROUPS: { label: string; entityType: ActivityEntityType }[] = [
  { label: 'Cards', entityType: 'card' },
  { label: 'Comentários', entityType: 'comment' },
  { label: 'Anexos', entityType: 'attachment' },
  { label: 'Colunas', entityType: 'column' },
  { label: 'Membros', entityType: 'member' },
  { label: 'Projeto', entityType: 'board' },
];
