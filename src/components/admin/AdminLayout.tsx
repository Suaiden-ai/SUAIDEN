import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Briefcase, 
  PlusCircle, 
  LogOut, 
  LayoutDashboard,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { Button } from '../jobs/ui/button';
import { supabase } from '../../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'Candidatos', path: '/admin/candidates' },
    { icon: Briefcase, label: 'Gerenciar Vagas', path: '/admin/jobs' },
    { icon: PlusCircle, label: 'Criar Vaga', path: '/admin/jobs/new' },
  ];

  return (
    <div className="flex min-h-screen bg-[#050505] text-foreground overflow-hidden">
      {/* Decorative gradients */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none z-0" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full translate-y-1/4 -translate-x-1/4 pointer-events-none z-0" />

      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 h-screen z-20">
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(131,52,255,0.6)]">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">Suaiden</h1>
              <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] leading-none">Admin Panel</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden
                ${isActive 
                  ? 'bg-primary/10 text-white border border-primary/30 shadow-[0_0_20px_rgba(131,52,255,0.1)]' 
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent'}
              `}
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-4 relative z-10">
                    <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'group-hover:text-primary'}`} />
                    <span className="font-bold tracking-tight">{item.label}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-all duration-300 ${isActive ? 'opacity-100 text-primary translate-x-0' : 'opacity-0 -translate-x-2'}`} />
                  
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <motion.div 
                      layoutId="activeSideBar"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_15px_rgba(131,52,255,1)]"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 bg-black/20">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-white hover:bg-destructive/10 hover:border-destructive/20 border border-transparent rounded-xl h-12 transition-all font-bold group"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3 group-hover:text-destructive transition-colors" />
            <span>Sair da Conta</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[50] bg-black/80 backdrop-blur-md border-b border-white/5 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold">S</span>
          </div>
          <span className="font-bold text-white">Suaiden Admin</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white/5 rounded-lg border border-white/10"
        >
          {isMobileMenuOpen ? <X className="text-white" /> : <Menu className="text-white" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="lg:hidden fixed inset-0 z-[40] bg-black p-8 pt-28 space-y-4"
          >
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-4 p-5 rounded-2xl border
                  ${isActive ? 'bg-primary/10 text-white border-primary/30' : 'text-muted-foreground border-transparent bg-white/5'}
                `}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-lg font-bold">{item.label}</span>
              </NavLink>
            ))}
            <div className="pt-8 mt-8 border-t border-white/5">
              <Button 
                variant="destructive" 
                className="w-full h-14 rounded-2xl font-black text-lg shadow-lg shadow-destructive/20"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5 mr-3" />
                SAIR
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto relative z-10 pt-20 lg:pt-0">
        <div className="max-w-7xl mx-auto p-6 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
