import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, LayoutDashboard, LayoutGrid, Clock, UserCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useBoardBackground } from '../../context/BoardBackgroundContext';
import WorkJourneyWidget from './WorkJourneyWidget';
import ProfileModal from './ProfileModal';

interface UserLayoutProps {
  children: React.ReactNode;
  fluid?: boolean;
}

interface UserProfile {
  full_name: string;
  email: string;
  role?: string;
  avatar_url?: string | null;
}

const UserLayout: React.FC<UserLayoutProps> = ({ children, fluid }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { boardBackground } = useBoardBackground();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);

        // Tenta ler o role direto dos metadados do JWT (sem query extra)
        const metaRole =
          (session.user.app_metadata?.role as string | undefined) ??
          (session.user.user_metadata?.role as string | undefined) ??
          null;
        
        if (metaRole) {
          console.log('[UserLayout] role from JWT metadata:', metaRole);
          setUserRole(metaRole);
        }

        // Busca o perfil completo no banco
        // `avatar_url` pode ainda não existir (migration 0005 não aplicada).
        // Se falhar, refaz sem a coluna para não perder nome/email/role.
        let { data, error } = await supabase
          .from('profiles')
          .select('full_name, email, role, avatar_url')
          .eq('id', session.user.id)
          .single();
        if (error) {
          ({ data, error } = await supabase
            .from('profiles')
            .select('full_name, email, role')
            .eq('id', session.user.id)
            .single());
        }

        console.log('[UserLayout] fetchProfile result:', { data, error });

        if (data) {
          setProfile(data);
          setUserRole(data.role ?? metaRole);
          console.log('[UserLayout] profile.role from DB:', data.role);
        } else {
          console.warn('[UserLayout] profile data is null. Error:', error);
        }
      }
    };
    fetchProfile();

    // Fechar dropdown ao clicar fora
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isDeveloper = userRole?.toLowerCase() === 'developer' || profile?.role?.toLowerCase() === 'developer';
  const isAdmin = userRole?.toLowerCase() === 'admin' || profile?.role?.toLowerCase() === 'admin';
  const isDevOrAdmin = isDeveloper || isAdmin;

  return (
    <div className={`text-foreground flex flex-col relative ${fluid ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'}`} style={{ background: '#050505' }}>
      {/* Board background layer - aplicado quando estiver em um quadro */}
      {boardBackground.background && (
        <>
          <div
            className="fixed inset-0 z-0 transition-all duration-700"
            style={
              boardBackground.bg_type === 'gradient'
                ? { background: boardBackground.background }
                : { backgroundImage: `url(${boardBackground.background})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            }
          />
          <div className="fixed inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />
        </>
      )}

      {/* Decorative gradients - só aparecem quando não há background de board */}
      {!boardBackground.background && (
        <>
          <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none z-0" />
          <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full translate-y-1/4 -translate-x-1/4 pointer-events-none z-0" />
        </>
      )}

      {/* Header Superior */}
      <header className={`fixed top-0 left-0 right-0 h-12 z-50 flex items-center justify-between px-3 lg:px-6 transition-all duration-300 ${boardBackground.background
          ? 'border-b border-[#2c333a] bg-[#1d2125]'
          : 'border-b border-white/5 bg-black/40 backdrop-blur-2xl'
        }`}>
        {/* Brand / Logo */}
        <div className="flex items-center gap-2">
          <img
            src="/Logo_Suaiden.png"
            alt="Suaiden Logo"
            className="h-7 w-auto"
          />
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-none">Suaiden</h1>
            <span className="text-[8px] text-primary font-black uppercase tracking-[0.15em] leading-none mt-0.5 block">
              {isAdmin ? 'Painel Administrativo' : isDeveloper ? 'Painel do Desenvolvedor' : 'Painel do Cliente'}
            </span>
          </div>
        </div>

        {/* Ações: Jornada (dev) + Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          {userId && isDevOrAdmin && (
            <WorkJourneyWidget userId={userId} />
          )}

          {/* User Actions & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 p-1.5 pr-3 rounded-full transition-all outline-none focus:ring-1 focus:ring-primary/50 group"
            >
              {/* Avatar Círculo */}
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white shadow-sm text-sm overflow-hidden group-hover:scale-105 transition-transform">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : profile?.full_name ? (
                  profile.full_name.charAt(0).toUpperCase()
                ) : (
                  'U'
                )}
              </div>

              <span className="hidden sm:inline text-xs font-semibold text-white/90 group-hover:text-white transition-colors">
                {profile?.full_name || 'Carregando...'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-white transition-all duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu com Framer Motion */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl p-2 z-[60] transition-all duration-300 ${boardBackground.background
                      ? 'bg-[#1d2125] border border-[#2c333a]'
                      : 'bg-[#0c0c0c] border border-white/5 backdrop-blur-xl'
                    }`}
                >
                  {/* User Info Header */}
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-medium text-muted-foreground">Logado como</p>
                    <p className="text-sm font-bold text-white truncate mt-0.5">{profile?.full_name || 'Usuário'}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{profile?.email || ''}</p>
                  </div>

                  <div className="h-px bg-white/5 my-1" />

                  {/* Editar perfil */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white hover:bg-primary/10 transition-all group"
                  >
                    <UserCircle className="w-4 h-4 group-hover:text-primary transition-colors" />
                    <span>Editar perfil</span>
                  </button>
                  <div className="h-px bg-white/5 my-1" />

                  {/* Voltar ao Dashboard (projetos) */}
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/dashboard');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white hover:bg-primary/10 transition-all group"
                  >
                    <LayoutGrid className="w-4 h-4 group-hover:text-primary transition-colors" />
                    <span>Dashboard</span>
                  </button>
                  <div className="h-px bg-white/5 my-1" />

                  {/* Voltar ao Painel do Admin se aplicável */}
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => navigate('/admin/boards')}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white hover:bg-primary/10 transition-all group"
                      >
                        <LayoutDashboard className="w-4 h-4 group-hover:text-primary transition-colors" />
                        <span>Ir para Painel Admin</span>
                      </button>
                      <div className="h-px bg-white/5 my-1" />
                    </>
                  )}

                  {/* Minha Jornada (para Devs e Admins) */}
                  {isDevOrAdmin && (
                    <>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate('/jornada');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white hover:bg-primary/10 transition-all group"
                      >
                        <Clock className="w-4 h-4 group-hover:text-primary transition-colors" />
                        <span>Minha Jornada</span>
                      </button>
                      <div className="h-px bg-white/5 my-1" />
                    </>
                  )}

                  {/* Logout Action Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white hover:bg-destructive/10 transition-all group"
                  >
                    <LogOut className="w-4 h-4 group-hover:text-destructive transition-colors" />
                    <span>Sair da Conta</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className={`flex-1 flex flex-col relative w-full transition-all duration-300 ${fluid
          ? 'px-4 md:px-6 max-w-full pt-[3.5rem] pb-4 h-[calc(100vh-3.5rem)] overflow-hidden'
          : 'px-6 lg:px-12 max-w-7xl mx-auto pt-16 pb-12'
        }`}>
        {children}
      </main>

      {userId && (
        <ProfileModal
          open={isProfileModalOpen}
          userId={userId}
          initialName={profile?.full_name ?? ''}
          initialAvatarUrl={profile?.avatar_url ?? null}
          onClose={() => setIsProfileModalOpen(false)}
          onSaved={({ full_name, avatar_url }) =>
            setProfile((prev) => (prev ? { ...prev, full_name, avatar_url } : prev))
          }
        />
      )}
    </div>
  );
};

export default UserLayout;
