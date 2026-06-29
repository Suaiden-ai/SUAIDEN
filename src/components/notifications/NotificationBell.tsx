import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Inbox, CheckCircle2, Check } from 'lucide-react';
import { supabase } from '../../services/supabase';
import {
  fetchNotifications,
  markAllAsRead,
  markAsRead,
  getNotificationMeta,
  type NotificationRow,
} from '../../lib/notifications';

// Mapa de ícones usados pelas notificações (lucide-react).
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Inbox,
  CheckCircle2,
  Bell,
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

interface NotificationBellProps {
  /** id do usuário logado; o sino só carrega quando presente */
  userId: string;
  /** estilo do board ativo muda o esquema de cores do dropdown */
  dark?: boolean;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, dark }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<NotificationRow | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    const rows = await fetchNotifications();
    setItems(rows);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void load();

    // Realtime: nova notificação para este usuário → atualiza lista + toast.
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
          setToast(row);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 6000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [userId, load]);

  // Fechar dropdown ao clicar fora.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const goTo = async (n: NotificationRow) => {
    setOpen(false);
    setToast(null);
    if (!n.read_at) {
      await markAsRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    if (n.board_id) navigate(`/quadro/${n.board_id}`);
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
  };

  if (!userId) return null;

  const panelCls = dark
    ? 'bg-[#1d2125] border border-[#2c333a]'
    : 'bg-[#0c0c0c] border border-white/5 backdrop-blur-xl';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-9 h-9 shrink-0 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all outline-none focus:ring-1 focus:ring-primary/50"
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl shadow-2xl p-2 z-[60] ${panelCls}`}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-bold text-white">Notificações</p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="h-px bg-white/5 my-1" />

            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <Bell className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma notificação</p>
                </div>
              ) : (
                items.map((n) => {
                  const meta = getNotificationMeta(n.type);
                  const Icon = ICONS[meta.icon] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      onClick={() => goTo(n)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-primary/10 ${
                        n.read_at ? 'opacity-60' : ''
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white leading-tight">{n.title}</p>
                        {n.body && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.body}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatRelative(n.created_at)}
                          {n.actor_name ? ` · ${n.actor_name}` : ''}
                        </p>
                      </div>
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast em tempo real (portal, canto inferior direito) */}
      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.button
              initial={{ opacity: 0, x: 40, y: 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.2 }}
              onClick={() => goTo(toast)}
              className="fixed bottom-4 right-4 z-[100] w-80 max-w-[90vw] flex items-start gap-3 px-4 py-3 rounded-2xl bg-[#1d2125] border border-[#2c333a] shadow-2xl text-left hover:border-primary/40 transition-colors"
            >
              {(() => {
                const meta = getNotificationMeta(toast.type);
                const Icon = ICONS[meta.icon] ?? Bell;
                return <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${meta.color}`} />;
              })()}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white leading-tight">{toast.title}</p>
                {toast.body && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{toast.body}</p>
                )}
              </div>
              <Check className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            </motion.button>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default NotificationBell;
