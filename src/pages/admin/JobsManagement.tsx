import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Trash2, 
  ExternalLink,
  MapPin,
  Clock,
  DollarSign,
  Briefcase,
  ChevronRight,
  Power
} from 'lucide-react';
import { Button } from '../../components/jobs/ui/button';
import { Input } from '../../components/jobs/ui/input';
import { Badge } from '../../components/jobs/ui/badge';
import { Switch } from '../../components/jobs/ui/switch';
import { jobsService, type Job } from '../../services/jobs';
import { useToast } from '../../hooks/jobs/use-toast';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';

const JobsManagement: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const data = await jobsService.getAllJobsForAdmin();
      setJobs(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar vagas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.')) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Vaga excluída", description: "A vaga foi removida permanentemente." });
      setJobs(jobs.filter(job => job.id !== id));
    } catch (error: any) {
      toast({
        title: "Erro ao excluir vaga",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (job: Job) => {
    try {
      await jobsService.toggleJobStatus(job.id, job.is_active);
      toast({ 
        title: job.is_active ? "Vaga Desativada" : "Vaga Ativada", 
        description: `A vaga agora está ${job.is_active ? 'inativa' : 'ativa'} e ${job.is_active ? 'não aparecerá' : 'aparecerá'} no portal.` 
      });
      setJobs(jobs.map(j => j.id === job.id ? { ...j, is_active: !j.is_active } : j));
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b border-white/5">
        <div className="space-y-4">
          <Badge variant="tech" className="px-4 py-1.5 bg-primary/20 border-primary/40 text-primary font-black uppercase tracking-widest text-[10px]">
            Oportunidades Ativas
          </Badge>
          <h1 className="text-5xl font-black tracking-tight text-white italic">
            Dashboard de <span className="text-primary not-italic tracking-tighter">Vagas</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-xl">
            Gerencie todas as oportunidades publicadas e acompanhe a atratividade da <span className="text-white font-bold">Suaiden</span>.
          </p>
        </div>
        
        <Link to="/admin/jobs/new">
          <Button className="rounded-2xl h-16 px-8 shadow-[0_10px_30px_rgba(131,52,255,0.3)] bg-primary hover:bg-primary/90 text-white font-black text-lg transition-all transform hover:-translate-y-1 active:scale-95 border-none">
            <Plus className="w-6 h-6 mr-3" />
            Nova Vaga
          </Button>
        </Link>
      </div>

      <div className="relative group max-w-2xl">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-primary transition-all duration-300 group-focus-within:scale-110 shadow-[0_0_15px_rgba(131,52,255,0.4)]" />
        <Input 
          placeholder="Buscar por título, localização ou tag..." 
          className="pl-16 h-16 bg-black/40 border-white/10 rounded-2xl focus:border-primary/50 focus:ring-primary/20 text-lg transition-all font-medium text-white placeholder:text-muted-foreground"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 bg-white/[0.03] animate-pulse rounded-[2.5rem] border border-white/5" />
          ))
        ) : filteredJobs.length === 0 ? (
          <div className="col-span-full py-32 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10 flex flex-col items-center text-center backdrop-blur-sm">
            <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
              <Briefcase className="w-10 h-10 text-primary opacity-30" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">Nenhuma vaga encontrada</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-lg">
              Comece criando uma nova oportunidade para atrair talentos.
            </p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, scale: 1.01 }}
              className="bg-black/50 border border-white/5 p-8 rounded-[2.5rem] hover:border-primary/40 transition-all duration-500 group relative overflow-hidden backdrop-blur-xl shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary/20 transition-all" />
              
              <div className="absolute top-0 right-0 p-6 flex items-center gap-4 z-10">
                <Switch 
                  checked={job.is_active} 
                  onCheckedChange={() => handleToggleStatus(job)}
                  className="shadow-[0_0_20px_rgba(148,118,255,0.4)] transition-all active:scale-90"
                />
                <div className="flex gap-2">
                  <Link to={`/vaga/${job.slug}`} target="_blank">
                    <Button variant="ghost" size="icon" className="h-11 w-11 text-white hover:bg-primary/20 hover:text-primary rounded-xl border border-white/10 hover:border-primary/30 transition-all bg-black/40 backdrop-blur-sm shadow-lg">
                      <ExternalLink className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-11 w-11 text-white hover:bg-destructive/20 hover:text-destructive rounded-xl border border-white/10 hover:border-destructive/30 transition-all bg-black/40 backdrop-blur-sm shadow-lg"
                    onClick={() => handleDeleteJob(job.id)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="pr-24">
                  <div className="flex items-center gap-3 mb-2">
                    {job.is_active ? (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-none text-[10px] font-black uppercase tracking-widest px-2 py-0.5">Ativa</Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-500 border-none text-[10px] font-black uppercase tracking-widest px-2 py-0.5">Inativa</Badge>
                    )}
                  </div>
                  <h3 className={`text-2xl font-black transition-colors duration-300 tracking-tight leading-tight italic ${job.is_active ? 'text-white group-hover:text-primary' : 'text-white/30'}`}>
                    {job.title}
                  </h3>
                  <p className={`text-base line-clamp-2 mt-4 leading-relaxed font-medium ${job.is_active ? 'text-muted-foreground' : 'text-muted-foreground/30'}`}>
                    {job.shortDescription}
                  </p>
                </div>

                <div className="flex flex-wrap gap-6 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground group-hover:text-white transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <MapPin className="w-4 h-4" />
                    </div>
                    {job.location}
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground group-hover:text-white transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Clock className="w-4 h-4" />
                    </div>
                    {job.type}
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground group-hover:text-white transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    {job.salary}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {job.techStack && job.techStack.slice(0, 4).map((tech, idx) => (
                    <Badge key={idx} variant="outline" className="text-[10px] font-black uppercase tracking-tighter px-3 py-1 border-primary/20 bg-primary/5 text-primary group-hover:border-primary/40 transition-all rounded-lg">
                      {tech}
                    </Badge>
                  ))}
                  {job.techStack && job.techStack.length > 4 && (
                    <Badge variant="outline" className="text-[10px] font-black px-3 py-1 border-white/10 bg-white/5 text-muted-foreground rounded-lg">
                      +{job.techStack.length - 4}
                    </Badge>
                  )}
                </div>
                
                <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <Link to={`/admin/jobs/edit/${job.id}`}>
                    <Button variant="link" className="text-primary font-black p-0 h-auto uppercase tracking-widest text-[10px] items-center">
                      Editar Vaga Completa <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default JobsManagement;
