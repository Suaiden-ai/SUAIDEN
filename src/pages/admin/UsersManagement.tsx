import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import {
  Loader2,
  Users as UsersIcon,
  Mail,
  Shield,
  Code2,
  User as UserIcon,
  Check,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../../components/jobs/ui/badge';

type Role = 'admin' | 'developer' | 'user';

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
}

const ROLE_CONFIG: Record<
  Role,
  { label: string; icon: React.ElementType; classes: string }
> = {
  admin: {
    label: 'Administrador',
    icon: Shield,
    classes: 'bg-primary/15 border-primary/40 text-primary',
  },
  developer: {
    label: 'Desenvolvedor',
    icon: Code2,
    classes: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  },
  user: {
    label: 'Cliente',
    icon: UserIcon,
    classes: 'bg-white/5 border-white/15 text-white/70',
  },
};

const ROLE_ORDER: Role[] = ['admin', 'developer', 'user'];

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setCurrentUserId(session?.user.id ?? null);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers((data as UserRow[]) || []);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel('admin-users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleChangeRole = async (userId: string, newRole: Role) => {
    setOpenMenuId(null);
    const target = users.find((u) => u.id === userId);
    if (!target || target.role === newRole) return;

    setSavingId(userId);
    // Atualização otimista
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select('id');

      if (error) throw error;
      // RLS pode permitir a query mas filtrar a linha: retorna sucesso com 0 linhas.
      if (!data || data.length === 0) {
        throw new Error('Nenhuma linha atualizada — provável bloqueio de RLS (permissão).');
      }
    } catch (err) {
      console.error('Erro ao atualizar tipo de usuário:', err);
      // Reverter em caso de erro
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: target.role } : u))
      );
      alert('Não foi possível alterar o tipo do usuário. Tente novamente.');
    } finally {
      setSavingId(null);
    }
  };

  const getInitials = (u: UserRow) => {
    const name = u.full_name || u.email;
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

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
            Controle de Acesso
          </Badge>
          <h1 className="text-5xl font-black tracking-tight text-white italic">Usuários</h1>
          <p className="text-muted-foreground text-xl max-w-xl">
            Gerencie os tipos de usuário (Administrador, Desenvolvedor e Cliente).
          </p>
        </div>
        <div className="flex items-center gap-3 text-white/70">
          <UsersIcon className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold">
            {users.length} usuário{users.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Lista de usuários */}
      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <UsersIcon className="w-10 h-10 text-white/20" />
          <p className="text-white/50 font-medium">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <section className="space-y-3">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const config = ROLE_CONFIG[u.role];
            const RoleIcon = config.icon;
            const isMenuOpen = openMenuId === u.id;

            return (
              <div
                key={u.id}
                className={`rounded-2xl border bg-[#1d2125] p-5 flex items-center gap-4 transition-colors ${
                  isMenuOpen ? 'border-primary/30 z-20 relative' : 'border-white/5'
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-black">
                  {getInitials(u)}
                </div>

                {/* Nome / email */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold truncate flex items-center gap-2">
                    {u.full_name || 'Sem nome'}
                    {isSelf && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full">
                        Você
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-0.5">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                </div>

                {/* Seletor de tipo de usuário */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    disabled={isSelf || savingId === u.id}
                    onClick={() => setOpenMenuId(isMenuOpen ? null : u.id)}
                    title={
                      isSelf
                        ? 'Você não pode alterar o seu próprio tipo de usuário'
                        : 'Alterar tipo de usuário'
                    }
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${config.classes} ${
                      isSelf
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:brightness-125 cursor-pointer'
                    }`}
                  >
                    {savingId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RoleIcon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{config.label}</span>
                    {!isSelf && (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>

                  {/* Dropdown de roles */}
                  <AnimatePresence>
                    {isMenuOpen && !isSelf && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute right-0 mt-2 w-52 bg-[#1d2125] border border-white/10 rounded-xl shadow-2xl p-1.5 z-30"
                      >
                        {ROLE_ORDER.map((role) => {
                          const opt = ROLE_CONFIG[role];
                          const OptIcon = opt.icon;
                          const isCurrent = role === u.role;
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => handleChangeRole(u.id, role)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                                isCurrent
                                  ? 'bg-white/5 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <OptIcon className="w-4 h-4 shrink-0" />
                              <span className="flex-1 text-left">{opt.label}</span>
                              {isCurrent && <Check className="w-4 h-4 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Overlay para fechar o dropdown ao clicar fora */}
      {openMenuId && (
        <div className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
};

export default UsersManagement;
