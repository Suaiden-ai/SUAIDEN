import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import {
  Loader2,
  Code2,
  ChevronRight,
  Mail,
  FolderKanban
} from 'lucide-react';
import { Badge } from '../../components/jobs/ui/badge';

interface DeveloperProject {
  id: string;
  title: string;
  isOwner: boolean;
}

interface Developer {
  id: string;
  full_name: string | null;
  email: string;
  projects: DeveloperProject[];
}

const DevelopersManagement: React.FC = () => {
  const navigate = useNavigate();
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Buscar todos os desenvolvedores
      const { data: devs, error: devsError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'developer')
        .order('full_name', { ascending: true });

      if (devsError) throw devsError;

      // 2. Buscar todos os projetos (para mapear título e dono)
      const { data: boards, error: boardsError } = await supabase
        .from('boards')
        .select('id, title, owner_id');

      if (boardsError) throw boardsError;

      // 3. Buscar todas as associações de membros
      const { data: members, error: membersError } = await supabase
        .from('board_members')
        .select('board_id, user_id');

      if (membersError) throw membersError;

      const boardsById = new Map(
        (boards || []).map((b) => [b.id, { id: b.id, title: b.title, owner_id: b.owner_id }])
      );

      // Montar a lista de projetos por desenvolvedor (dono ou membro)
      const developersWithProjects: Developer[] = (devs || []).map((dev) => {
        const projectMap = new Map<string, DeveloperProject>();

        // Projetos onde é dono
        (boards || [])
          .filter((b) => b.owner_id === dev.id)
          .forEach((b) => projectMap.set(b.id, { id: b.id, title: b.title, isOwner: true }));

        // Projetos onde é membro
        (members || [])
          .filter((m) => m.user_id === dev.id)
          .forEach((m) => {
            const board = boardsById.get(m.board_id);
            if (board && !projectMap.has(board.id)) {
              projectMap.set(board.id, { id: board.id, title: board.title, isOwner: false });
            }
          });

        return {
          id: dev.id,
          full_name: dev.full_name,
          email: dev.email,
          projects: Array.from(projectMap.values()).sort((a, b) =>
            a.title.localeCompare(b.title)
          ),
        };
      });

      setDevelopers(developersWithProjects);
    } catch (err) {
      console.error('Erro ao buscar desenvolvedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel('admin-developers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_members' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const getInitials = (dev: Developer) => {
    const name = dev.full_name || dev.email;
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
            Equipe de Desenvolvimento
          </Badge>
          <h1 className="text-5xl font-black tracking-tight text-white italic">
            Desenvolvedores
          </h1>
          <p className="text-muted-foreground text-xl max-w-xl">
            Veja a equipe e os projetos pelos quais cada desenvolvedor é responsável.
          </p>
        </div>
        <div className="flex items-center gap-3 text-white/70">
          <Code2 className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold">
            {developers.length} desenvolvedor{developers.length === 1 ? '' : 'es'}
          </span>
        </div>
      </div>

      {/* Lista de desenvolvedores */}
      {developers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Code2 className="w-10 h-10 text-white/20" />
          <p className="text-white/50 font-medium">Nenhum desenvolvedor cadastrado.</p>
        </div>
      ) : (
        <section className="space-y-3">
          {developers.map((dev) => (
            <button
              key={dev.id}
              type="button"
              onClick={() => navigate(`/admin/developers/${dev.id}`)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border border-white/5 bg-[#1d2125] hover:border-primary/30 hover:bg-white/[0.03] transition-all text-left"
            >
              {/* Avatar */}
              <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-black">
                {getInitials(dev)}
              </div>

              {/* Nome / email */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold truncate">
                  {dev.full_name || 'Sem nome'}
                </h3>
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-0.5">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{dev.email}</span>
                </div>
              </div>

              {/* Contador de projetos */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-white/80 shrink-0">
                <FolderKanban className="w-3.5 h-3.5 text-primary" />
                {dev.projects.length} projeto{dev.projects.length === 1 ? '' : 's'}
              </div>

              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </section>
      )}
    </div>
  );
};

export default DevelopersManagement;
