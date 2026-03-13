import { useState, useEffect } from 'react';
import { 
  Save, 
  CheckCircle,
  Zap,
  ChevronLeft,
  Loader2,
  MapPin,
  Clock,
  DollarSign,
  Briefcase,
  X
} from 'lucide-react';
import { Button } from '../../components/jobs/ui/button';
import { Input } from '../../components/jobs/ui/input';
import { useToast } from '../../hooks/jobs/use-toast';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Badge } from '../../components/jobs/ui/badge';
import { supabase } from '../../services/supabase';

const EditJobPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  const [formData, setFormData] = useState({
    title: '',
    shortDescription: '',
    fullDescription: '',
    salary: '',
    location: '',
    type: 'Full-time (40h)',
    techStack: [] as string[],
    requirements: [] as string[],
    benefits: [] as { icon_name: string, text: string }[],
    team: [] as string[],
    is_active: true
  });

  const [newTech, setNewTech] = useState('');
  const [newReq, setNewReq] = useState('');

  useEffect(() => {
    if (id) {
      fetchJob();
    }
  }, [id]);

  const fetchJob = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title || '',
        shortDescription: data.short_description || '',
        fullDescription: data.full_description || '',
        salary: data.salary || '',
        location: data.location || '',
        type: data.type || 'Full-time (40h)',
        techStack: data.tech_stack || [],
        requirements: data.requirements || [],
        benefits: data.benefits || [],
        team: data.team || [],
        is_active: data.is_active
      });
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.title || !formData.shortDescription) {
      toast({ title: "Erro", description: "Título e descrição curta são obrigatórios.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const slug = formData.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      
      const { error } = await supabase
        .from('jobs')
        .update({
          title: formData.title,
          slug,
          short_description: formData.shortDescription,
          full_description: formData.fullDescription,
          salary: formData.salary,
          location: formData.location,
          type: formData.type,
          tech_stack: formData.techStack,
          requirements: formData.requirements,
          benefits: formData.benefits,
          team: formData.team,
          is_active: formData.is_active
        })
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Vaga atualizada!", description: "As alterações foram salvas com sucesso." });
      navigate('/admin/jobs');
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const addTech = () => { if (newTech) { setFormData({ ...formData, techStack: [...formData.techStack, newTech] }); setNewTech(''); } };
  const addReq = () => { if (newReq) { setFormData({ ...formData, requirements: [...formData.requirements, newReq] }); setNewReq(''); } };

  if (isFetching) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground font-bold italic tracking-widest text-sm uppercase">Carregando Oportunidade...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-center gap-8 border-b border-white/5 pb-10">
        <Link to="/admin/jobs">
          <Button variant="ghost" className="h-14 w-14 rounded-full border border-white/10 hover:bg-primary/20 hover:text-white transition-all group">
            <ChevronLeft className="w-7 h-7 group-hover:-translate-x-1 transition-transform" />
          </Button>
        </Link>
        <div className="space-y-2">
          <Badge variant="tech" className="px-4 py-1.5 bg-primary/20 border-primary/40 text-primary font-black uppercase tracking-widest text-[10px]">
            Edição de Conteúdo
          </Badge>
          <h1 className="text-5xl font-black tracking-tight text-white italic">
            Editar <span className="text-primary not-italic tracking-tighter">Oportunidade</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Left Column: Form */}
        <div className="xl:col-span-2 space-y-10">
          <div className="bg-black/40 border border-white/5 rounded-[3rem] p-12 space-y-10 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-primary/10 transition-all" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-[0.3em] text-primary ml-1">Título da Vaga</label>
                <Input 
                  required 
                  className="h-16 bg-black/60 border-white/10 rounded-2xl focus:border-primary/50 focus:ring-primary/20 text-lg transition-all text-white font-bold"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-[0.3em] text-primary ml-1">Salário Estimado</label>
                <div className="relative">
                  <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary opacity-50" />
                  <Input 
                    className="h-16 pl-12 bg-black/60 border-white/10 rounded-2xl focus:border-primary/50 focus:ring-primary/20 text-lg transition-all text-white font-bold"
                    value={formData.salary}
                    onChange={e => setFormData({ ...formData, salary: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-[0.3em] text-primary ml-1">Localização</label>
                <div className="relative">
                  <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary opacity-50" />
                  <Input 
                    className="h-16 pl-12 bg-black/60 border-white/10 rounded-2xl focus:border-primary/50 focus:ring-primary/20 text-lg transition-all text-white font-bold"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-[0.3em] text-primary ml-1">Tipo de Carga Horária</label>
                <div className="relative">
                  <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary opacity-50" />
                  <Input 
                    className="h-16 pl-12 bg-black/60 border-white/10 rounded-2xl focus:border-primary/50 focus:ring-primary/20 text-lg transition-all text-white font-bold"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-[0.3em] text-primary ml-1">Chamada Rápida (Slogan da Vaga)</label>
              <Input 
                className="h-16 bg-black/60 border-white/10 rounded-2xl focus:border-primary/50 focus:ring-primary/20 text-lg transition-all text-white font-medium"
                value={formData.shortDescription}
                onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-[0.3em] text-primary ml-1">Descrição Detalhada</label>
              <textarea 
                required
                rows={6}
                className="w-full bg-black/60 border-white/10 border rounded-3xl p-6 focus:border-primary/50 focus:ring-primary/20 text-lg transition-all text-white outline-none font-medium leading-relaxed"
                value={formData.fullDescription}
                onChange={e => setFormData({ ...formData, fullDescription: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Tech Stack */}
            <div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-10 space-y-6 backdrop-blur-xl group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 shadow-[0_0_10px_rgba(131,52,255,0.4)]" />
                </div>
                <h3 className="text-lg font-black text-white italic tracking-tight">Tecnologias</h3>
              </div>
              <div className="flex gap-3">
                <Input 
                  value={newTech} 
                  onChange={e => setNewTech(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addTech()}
                  className="bg-black/60 border-white/10 rounded-xl focus:border-primary/40 focus:ring-primary/10 h-12"
                />
                <Button onClick={addTech} className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 shadow-lg shadow-primary/20 px-6 font-bold">ADD</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.techStack.map((tech, i) => (
                  <Badge key={i} className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 font-bold rounded-lg flex gap-2 items-center group/badge">
                    {tech}
                    <button onClick={() => setFormData({ ...formData, techStack: formData.techStack.filter((_, idx) => idx !== i) })}>
                      <X className="w-3 h-3 hover:text-white transition-colors" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-10 space-y-6 backdrop-blur-xl group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <CheckCircle className="w-5 h-5 shadow-[0_0_10px_rgba(131,52,255,0.4)]" />
                </div>
                <h3 className="text-lg font-black text-white italic tracking-tight">Requisitos</h3>
              </div>
              <div className="flex gap-3">
                <Input 
                  value={newReq} 
                  onChange={e => setNewReq(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addReq()}
                  className="bg-black/60 border-white/10 rounded-xl focus:border-primary/40 focus:ring-primary/10 h-12"
                />
                <Button onClick={addReq} className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 shadow-lg shadow-primary/20 px-6 font-bold">ADD</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.requirements.map((req, i) => (
                  <Badge key={i} className="bg-white/5 text-muted-foreground border border-white/10 px-3 py-1 font-bold rounded-lg flex gap-2 items-center">
                    {req}
                    <button onClick={() => setFormData({ ...formData, requirements: formData.requirements.filter((_, idx) => idx !== i) })}>
                      <X className="w-3 h-3 hover:text-white transition-colors" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Action */}
        <div className="space-y-8">
          <div className="sticky top-12 space-y-8">
            <div className="bg-gradient-to-br from-primary/30 via-black/80 to-black border border-primary/20 rounded-[3rem] p-10 space-y-8 shadow-[0_0_50px_rgba(131,52,255,0.15)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[80px] -mr-32 -mt-32 pointer-events-none group-hover:bg-primary/30 transition-all duration-700" />
              
              <div className="text-center space-y-4 relative z-10">
                <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(131,52,255,0.6)] rotate-6 group-hover:rotate-0 transition-transform duration-500">
                  <Briefcase className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-white italic tracking-tight">Salvar Alterações</h3>
                <p className="text-muted-foreground text-sm font-medium leading-relaxed px-4">
                  As mudanças serão aplicadas imediatamente ao portal público.
                </p>
              </div>

              <div className="space-y-4 pt-6 relative z-10">
                <Button 
                  onClick={handleUpdate} 
                  disabled={isLoading}
                  className="w-full h-20 bg-primary hover:bg-primary/90 text-white font-black text-xl rounded-2xl shadow-[0_15px_40px_rgba(131,52,255,0.3)] transition-all transform hover:-translate-y-1 active:scale-95 border-none uppercase tracking-widest disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : <> <Save className="w-6 h-6 mr-3" /> SALVAR VAGA </>}
                </Button>
                
                <Button 
                  variant="ghost" 
                  className="w-full h-14 text-muted-foreground hover:text-white hover:bg-white/5 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all border border-transparent hover:border-white/10"
                  onClick={() => navigate('/admin/jobs')}
                >
                  Cancelar Edição
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditJobPage;
