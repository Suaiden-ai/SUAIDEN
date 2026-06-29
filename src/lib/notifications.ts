import { supabase } from '../services/supabase';

// ============================================================
// Sistema de notificações internas (notifications)
// Helper centralizado para criar, consultar e marcar como lidas
// as notificações in-app. Ver migration 0011_notifications.sql.
//
// Padrão espelhado em lib/activityLog.ts: as funções de escrita
// nunca lançam — uma falha de notificação não deve bloquear o
// fluxo principal do usuário.
// ============================================================

export type NotificationType = 'new_ticket' | 'task_completed';

export interface NotificationRow {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  board_id: string | null;
  task_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface InsertNotification {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  boardId?: string | null;
  taskId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
}

/** Insere várias notificações de uma vez (uma por destinatário). */
async function insertMany(rows: InsertNotification[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { error } = await supabase.from('notifications').insert(
      rows.map((r) => ({
        recipient_id: r.recipientId,
        type: r.type,
        title: r.title,
        body: r.body ?? null,
        board_id: r.boardId ?? null,
        task_id: r.taskId ?? null,
        actor_id: r.actorId ?? null,
        actor_name: r.actorName ?? null,
        metadata: r.metadata ?? {},
      }))
    );
    if (error) console.error('[notifications] erro ao criar:', error.message);
  } catch (err) {
    console.error('[notifications] exceção ao criar:', err);
  }
}

// ── Resolução de destinatários ──

interface BoardMemberRow {
  user_id: string;
  profiles: { role: string | null } | null;
}

/** IDs dos desenvolvedores membros de um quadro. */
async function getBoardDeveloperIds(boardId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('board_members')
    .select('user_id, profiles:user_id (role)')
    .eq('board_id', boardId);
  if (error || !data) return [];
  return (data as unknown as BoardMemberRow[])
    .filter((m) => m.profiles?.role?.toLowerCase() === 'developer')
    .map((m) => m.user_id);
}

/** ID do cliente (dono) de um quadro. */
async function getBoardOwnerId(boardId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('boards')
    .select('owner_id')
    .eq('id', boardId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.owner_id as string) ?? null;
}

/** IDs de todos os administradores do sistema. */
async function getAdminIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');
  if (error || !data) return [];
  return (data as { id: string }[]).map((p) => p.id);
}

// ── Geradores de evento ──

/**
 * Novo chamado entrou em um quadro → notifica os DESENVOLVEDORES
 * membros do quadro e todos os ADMINS. O autor (quem criou) não é
 * notificado.
 */
export async function notifyNewTicket(input: {
  boardId: string;
  boardTitle?: string | null;
  taskId: string;
  taskTitle: string;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<void> {
  const [devIds, adminIds] = await Promise.all([
    getBoardDeveloperIds(input.boardId),
    getAdminIds(),
  ]);

  // Dedup: devs do quadro + admins, sem o autor da ação.
  const recipientSet = new Set<string>([...devIds, ...adminIds]);
  if (input.actorId) recipientSet.delete(input.actorId);

  await insertMany(
    Array.from(recipientSet).map((recipientId) => ({
      recipientId,
      type: 'new_ticket' as const,
      title: 'Novo chamado',
      body: input.taskTitle,
      boardId: input.boardId,
      taskId: input.taskId,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      metadata: { boardTitle: input.boardTitle ?? null },
    }))
  );
}

/**
 * Tarefa concluída (is_done = true) → notifica o CLIENTE (dono do
 * quadro) e todos os ADMINS. Quem concluiu não é notificado.
 */
export async function notifyTaskCompleted(input: {
  boardId: string;
  boardTitle?: string | null;
  taskId: string;
  taskTitle: string;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<void> {
  const [ownerId, adminIds] = await Promise.all([
    getBoardOwnerId(input.boardId),
    getAdminIds(),
  ]);

  // Dedup: dono + admins, sem o autor da ação.
  const recipientSet = new Set<string>();
  if (ownerId) recipientSet.add(ownerId);
  adminIds.forEach((id) => recipientSet.add(id));
  if (input.actorId) recipientSet.delete(input.actorId);

  await insertMany(
    Array.from(recipientSet).map((recipientId) => ({
      recipientId,
      type: 'task_completed' as const,
      title: 'Tarefa concluída',
      body: input.taskTitle,
      boardId: input.boardId,
      taskId: input.taskId,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      metadata: { boardTitle: input.boardTitle ?? null },
    }))
  );
}

// ── Leitura / estado ──

export async function fetchNotifications(limit = 30): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[notifications] erro ao buscar:', error.message);
    return [];
  }
  return (data as NotificationRow[]) ?? [];
}

export async function markAsRead(id: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);
  } catch (err) {
    console.error('[notifications] erro ao marcar como lida:', err);
  }
}

export async function markAllAsRead(): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
  } catch (err) {
    console.error('[notifications] erro ao marcar todas como lidas:', err);
  }
}

// ── Apresentação ──

interface NotificationMeta {
  icon: string; // nome do ícone lucide-react
  color: string; // classe tailwind text-*
}

const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  new_ticket: { icon: 'Inbox', color: 'text-amber-400' },
  task_completed: { icon: 'CheckCircle2', color: 'text-emerald-400' },
};

const DEFAULT_NOTIFICATION_META: NotificationMeta = { icon: 'Bell', color: 'text-zinc-400' };

export function getNotificationMeta(type: string): NotificationMeta {
  return NOTIFICATION_META[type as NotificationType] ?? DEFAULT_NOTIFICATION_META;
}
