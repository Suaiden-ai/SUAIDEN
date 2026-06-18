import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { 
  Plus, 
  Loader2,
  Check,
  X,
  LayoutGrid,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../../components/jobs/ui/badge';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

interface Board {
  id: string;
  title: string;
  bg_type: 'gradient' | 'image';
  background: string;
  cover_image?: string | null;
}

const BoardsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para criação de novo quadro inline
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');

  // Estados para deleção e menu de opções
  const [activeMenuBoardId, setActiveMenuBoardId] = useState<string | null>(null);
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);

  // Gradientes padrões para novos quadros
  const defaultGradients = [
    'linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)', // Roxo/Lilás Suaiden
    'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)', // Azul
    'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Verde
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Laranja
    'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', // Vermelho
    'linear-gradient(135deg, #1e293b 0%, #334155 100%)'  // Cinza Escuro
  ];

  // Buscar perfil e quadros
  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // Buscar perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', userId)
        .single();
      
      if (profileData) {
        setProfile(profileData);
      }

      // Buscar quadros que o usuário é dono ou membro
      const { data: boardsData, error } = await supabase
        .from('boards')
        .select('id, title, bg_type, background, cover_image')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBoards(boardsData || []);

    } catch (err) {
      console.error('Erro ao buscar quadros do Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Habilitar escuta realtime para atualizar a lista de quadros
    const subscription = supabase
      .channel('admin-boards-changes')
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

  // Criar novo quadro no Supabase
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newBoardTitle.trim()) return;

    try {
      // Escolher gradiente aleatório para o fundo
      const randomGradient = defaultGradients[Math.floor(Math.random() * defaultGradients.length)];

      const { data, error } = await supabase
        .from('boards')
        .insert({
          title: newBoardTitle.trim(),
          bg_type: 'gradient',
          background: randomGradient,
          owner_id: profile.id
        })
        .select('id')
        .single();

      if (error) throw error;

      setIsCreating(false);
      setNewBoardTitle('');
      
      // Redirecionar diretamente para o quadro recém-criado
      if (data) {
        navigate(`/quadro/${data.id}`);
      }
    } catch (err) {
      console.error('Erro ao criar quadro:', err);
    }
  };

  // Deletar quadro no Supabase
  const handleDeleteBoard = async (boardId: string) => {
    try {
      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao deletar projeto:', err);
      alert('Ocorreu um erro ao excluir o projeto. Por favor, tente novamente.');
    }
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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b border-white/5">
        <div className="space-y-4">
          <Badge variant="tech" className="px-4 py-1.5 bg-primary/20 border-primary/40 text-primary font-black uppercase tracking-widest text-[10px]">
            Projetos da Administração
          </Badge>
          <h1 className="text-5xl font-black tracking-tight text-white italic">
            Gerenciar <span className="text-primary not-italic tracking-tighter">Projetos</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-xl">
            Crie, acesse e gerencie seus projetos de tarefas.
          </p>
        </div>
      </div>

      {/* Seção dos quadros */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(131,52,255,0.3)]">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-white font-extrabold text-sm tracking-wider uppercase">Seus Projetos</h2>
          </div>
        </div>

        {/* Grid de todos os quadros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {boards.map((board) => (
            <motion.div
              key={`admin-board-${board.id}`}
              onClick={() => navigate(`/quadro/${board.id}`)}
              whileHover={{ scale: 1.02, y: -2 }}
              className={`group relative h-28 rounded-2xl overflow-hidden cursor-pointer shadow-lg border border-white/5 flex flex-col bg-[#1d2125] ${
                activeMenuBoardId === board.id ? 'z-20 ring-1 ring-primary/30' : 'z-0'
              }`}
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

              {/* Botão de 3 pontinhos (Opções do Admin) - Fora das sub-divisões para não ser cortado */}
              <div className="absolute top-2 right-2 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuBoardId(activeMenuBoardId === board.id ? null : board.id);
                  }}
                  className="w-7 h-7 flex items-center justify-center bg-black/50 hover:bg-[#1d2125] text-white/70 hover:text-white rounded-lg transition-all border border-white/10"
                  title="Opções do projeto"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {activeMenuBoardId === board.id && (
                  <div className="absolute right-0 mt-1 w-36 bg-[#1d2125] border border-white/10 rounded-xl shadow-2xl p-1 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBoardToDelete(board);
                        setActiveMenuBoardId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Projeto
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Card: Criar novo quadro */}
          {isCreating ? (
            <motion.form
              onSubmit={handleCreateBoard}
              initial={{ scale: 0.98, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col h-28 rounded-2xl bg-[#1d2125] border border-primary/30 p-3 text-center justify-between"
            >
              <input
                type="text"
                autoFocus
                placeholder="Título do projeto..."
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="p-1 hover:bg-white/5 text-muted-foreground hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  className="p-1 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-md shadow-primary/20"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              onClick={() => setIsCreating(true)}
              whileHover={{ scale: 1.02, y: -2 }}
              className="flex flex-col items-center justify-center h-28 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.04] cursor-pointer transition-all p-4 text-center group"
            >
              <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4 text-muted-foreground group-hover:text-white" />
                Criar novo projeto
              </span>
            </motion.div>
          )}
        </div>
      </section>

      {/* Modal de confirmação de exclusão */}
      <AnimatePresence>
        {boardToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#1d2125] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Excluir Projeto</h3>
                <p className="text-sm text-white/60">
                  Tem certeza de que deseja excluir o projeto <strong className="text-white">"{boardToDelete.title}"</strong>?
                </p>
              </div>
              
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs leading-relaxed">
                <strong>Aviso importante:</strong> Esta ação é irreversível e excluirá permanentemente o quadro, todas as suas colunas, tarefas, checklists e comentários vinculados.
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setBoardToDelete(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    handleDeleteBoard(boardToDelete.id);
                    setBoardToDelete(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-red-600/20 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Overlay transparente para fechar o menu de 3 pontinhos ao clicar fora */}
      {activeMenuBoardId && (
        <div 
          className="fixed inset-0 z-10 cursor-default" 
          onClick={() => setActiveMenuBoardId(null)}
        />
      )}
    </div>
  );
};

export default BoardsManagement;
