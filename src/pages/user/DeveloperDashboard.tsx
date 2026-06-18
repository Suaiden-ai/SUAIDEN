import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { 
  Loader2,
  LayoutGrid
} from 'lucide-react';
import { motion } from 'framer-motion';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Board {
  id: string;
  title: string;
  bg_type: 'gradient' | 'image';
  background: string;
  cover_image?: string | null;
}

const DeveloperDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  // Criação de novos projetos desativada para a role developer

  // Buscar perfil e quadros
  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // Buscar perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', userId)
        .single();
      
      if (profileData) {
        setProfile(profileData);
      }

      // Buscar quadros que o desenvolvedor é dono ou membro
      const { data: boardsData, error } = await supabase
        .from('boards')
        .select('id, title, bg_type, background, cover_image')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBoards(boardsData || []);

    } catch (err) {
      console.error('Erro ao buscar dados do Dashboard do Desenvolvedor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Habilitar escuta realtime para atualizar a lista de quadros
    const subscription = supabase
      .channel('dev-dashboard-boards-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boards' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);



  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white mt-1 tracking-tight">
            Olá, {profile?.full_name || 'Desenvolvedor'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selecione um projeto para trabalhar.
          </p>
        </div>
      </div>

      {/* Seção: SEUS QUADROS */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(131,52,255,0.3)]">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-sm tracking-wider uppercase">Seus Projetos (Desenvolvimento)</h2>
            </div>
          </div>
        </div>

        {/* Grid de todos os quadros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {boards.map((board) => (
            <motion.div
              key={`all-${board.id}`}
              onClick={() => navigate(`/quadro/${board.id}`)}
              whileHover={{ scale: 1.02, y: -2 }}
              className="group relative h-28 rounded-2xl overflow-hidden cursor-pointer shadow-lg border border-white/5 flex flex-col bg-[#1d2125]"
            >
              {/* Parte Superior: Background do Quadro */}
              <div className="relative flex-1 w-full overflow-hidden">
                {board.cover_image ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" 
                    style={{ backgroundImage: `url(${board.cover_image})` }}
                  />
                ) : board.bg_type === 'gradient' ? (
                  <div className="absolute inset-0" style={{ background: board.background }} />
                ) : (
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" 
                    style={{ backgroundImage: `url(${board.background})` }}
                  />
                )}
                {/* Overlay suave para hover */}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              </div>
              
              {/* Parte Inferior: Faixa Cinza com o Título */}
              <div className="h-10 bg-[#1d2125] border-t border-white/5 px-3 flex items-center">
                <span className="text-white font-semibold text-xs tracking-wide truncate">
                  {board.title}
                </span>
              </div>
            </motion.div>
          ))}


        </div>
      </section>
    </div>
  );
};

export default DeveloperDashboard;
