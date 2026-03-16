import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { 
  Search, 
  Filter, 
  Eye, 
  Calendar, 
  Mail, 
  Phone, 
  Linkedin,
  Clock,
  ExternalLink,
  Download,
  X,
  FileText,
  FileDown,
  MessageCircle,
  Github,
  Globe,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/jobs/ui/button';
import { Input } from '../../components/jobs/ui/input';
import { Badge } from '../../components/jobs/ui/badge';
import { useToast } from '../../hooks/jobs/use-toast';
import { jobsService, type Job } from '../../services/jobs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/jobs/ui/select";

interface Candidate {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  whatsapp: string;
  job_slug: string;
  job_title: string;
  resume_url: string;
  linkedin_url: string;
  github_url?: string;
  portfolio_url?: string;
  internet_stable: string;
  contract_agreement: string;
  webcam_ready: string;
  schedule_option: string;
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className} 
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const CandidatesManagement: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCandidates();
    fetchJobs();
  }, []);

  useEffect(() => {
    filterCandidates();
  }, [searchQuery, selectedJob, candidates]);

  const fetchJobs = async () => {
    try {
      const data = await jobsService.getJobs();
      setJobsList(data);
    } catch (error) {
      console.error("Erro ao buscar vagas:", error);
    }
  };

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterCandidates = () => {
    let result = candidates;
    
    if (searchQuery) {
      result = result.filter(c => 
        c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedJob !== 'all') {
      result = result.filter(c => c.job_slug === selectedJob);
    }

    setFilteredCandidates(result);
  };

  const openResume = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('curriculum-vitae')
        .download(path);

      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      setResumeUrl(url);
      setIsResumeModalOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar currículo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const downloadResume = () => {
    if (!resumeUrl || !selectedCandidate) return;
    const link = document.createElement('a');
    link.href = resumeUrl;
    link.download = `CV_${selectedCandidate.full_name.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 pb-10 border-b border-white/5">
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Badge variant="tech" className="px-4 py-1.5 bg-primary/20 border-primary/40 text-primary font-black uppercase tracking-widest text-[10px]">
              Gerenciamento Administrativo
            </Badge>
          </motion.div>
          <h1 className="text-5xl font-black tracking-tight text-white">
            Portal de <span className="text-primary tracking-tighter">Candidatos</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl leading-relaxed">
            Faça a triagem dos talentos da <strong className="text-white">Suaiden</strong> em tempo real com ferramentas de filtro avançadas.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center bg-white/[0.03] p-2 rounded-3xl border border-white/5 backdrop-blur-sm">
          <div className="relative group flex-1 min-w-[300px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-70" />
            <Input 
              placeholder="Buscar por nome ou e-mail..." 
              className="pl-12 pr-6 h-12 w-full bg-black/40 border-white/10 rounded-2xl focus:border-primary/50 text-sm transition-all text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-full sm:w-[200px] bg-black/40 border-white/10 h-12 rounded-2xl text-sm px-6 text-white font-bold">
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-4 h-4 text-primary shrink-0" />
                <SelectValue placeholder="Filtrar por vaga" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#0f0f0f] border-white/10 rounded-xl">
              <SelectItem value="all" className="cursor-pointer py-2 rounded-lg text-muted-foreground font-bold hover:text-white transition-colors">
                Todas as Vagas
              </SelectItem>
              {jobsList.map(job => (
                <SelectItem key={job.id} value={job.slug} className="cursor-pointer py-2 rounded-lg text-muted-foreground font-bold hover:text-white transition-colors">
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List Content */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-white/5 animate-pulse rounded-3xl" />
          ))
        ) : filteredCandidates.length === 0 ? (
          <div className="bg-black/40 border border-white/5 rounded-[3rem] p-32 text-center backdrop-blur-xl">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6 border border-primary/10">
                <Search className="w-8 h-8 text-primary opacity-40" />
              </div>
              <p className="text-xl font-black text-white tracking-tight">Nenhum talento encontrado</p>
              <p className="text-muted-foreground mt-2 text-base">Tente ajustar seus termos de busca ou filtros.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredCandidates.map((c) => (
              <motion.div 
                key={c.id} 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/60 border border-white/5 hover:border-primary/30 p-6 rounded-[2rem] flex flex-col lg:flex-row items-center justify-between gap-6 transition-all duration-300 group"
              >
                {/* Perfil e Vaga */}
                <div className="flex items-center gap-6 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                    <span className="text-xl font-black text-primary">{c.full_name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-white truncate group-hover:text-primary transition-colors">{c.full_name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-xs font-medium text-muted-foreground truncate">{c.email}</span>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-widest border-primary/30 bg-primary/5 text-primary px-3 py-0.5 rounded-full whitespace-nowrap">
                        {c.job_title}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Data e Ações */}
                <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0 w-full lg:w-auto">
                  <div className="hidden xl:flex items-center text-xs text-muted-foreground gap-2 font-bold whitespace-nowrap">
                    <Calendar className="w-4 h-4 text-primary/60" />
                    {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1 sm:flex-initial h-11 px-4 text-muted-foreground hover:bg-primary/10 hover:text-white border border-transparent hover:border-primary/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                      onClick={() => setSelectedCandidate(c)}
                    >
                      <Eye className="w-4 h-4 mr-2 text-primary" />
                      Detalhes
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 sm:flex-initial h-11 px-4 border-primary/30 bg-primary/5 text-primary hover:bg-primary/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                      onClick={() => c.resume_url && openResume(c.resume_url)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      CV
                    </Button>
                    <a 
                      href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 sm:flex-initial"
                    >
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-11 px-4 border-green-500/30 bg-green-500/5 text-green-500 hover:bg-green-500 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                      >
                        <WhatsAppIcon className="w-4 h-4 mr-2" />
                        WhatsApp
                      </Button>
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Candidate Detail Modal */}
      <AnimatePresence>
        {selectedCandidate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setSelectedCandidate(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden"
            >
              {/* Header com Gradiente */}
              <div className="p-8 pb-6 border-b border-white/5 bg-gradient-to-br from-primary/10 via-transparent to-transparent flex justify-between items-center">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl">
                    <span className="text-2xl font-black text-primary">{selectedCandidate.full_name.charAt(0)}</span>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-white leading-tight">{selectedCandidate.full_name}</h2>
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-primary/30 bg-primary/5 text-primary px-2 py-0.5 rounded-md">
                        {selectedCandidate.job_title}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium">Cadastrado em {new Date(selectedCandidate.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-xl w-10 h-10 border border-white/10 text-white/50 hover:text-white hover:bg-white/5" 
                  onClick={() => setSelectedCandidate(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Grid de Informações Essenciais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Contato */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Canais de Contato</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5 group hover:border-primary/20 transition-all">
                        <Mail className="w-4 h-4 text-primary/60" />
                        <span className="text-sm font-bold text-white/90 truncate">{selectedCandidate.email}</span>
                      </div>
                      <a 
                        href={`https://wa.me/${selectedCandidate.whatsapp.replace(/\D/g, '')}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5 group hover:border-green-500/30 hover:bg-green-500/5 transition-all"
                      >
                        <WhatsAppIcon className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-bold text-white/90">{selectedCandidate.whatsapp}</span>
                        <ExternalLink className="w-3 h-3 ml-auto opacity-30" />
                      </a>
                    </div>
                  </div>

                  {/* Disponibilidade */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Disponibilidade Selecionada</h3>
                    <div className="p-4 bg-white/[0.03] rounded-xl border border-white/5 flex gap-3 items-start">
                      <Clock className="w-4 h-4 text-primary/60 mt-0.5" />
                      <span className="text-xs font-bold leading-relaxed text-white/80">
                        {selectedCandidate.schedule_option === 'opcao1' ? 'Turno 1: 13h - 20h (Seg-Sex) + Sáb 10h-15h' :
                         selectedCandidate.schedule_option === 'opcao2' ? 'Turno 2: 10h - 17h (Seg-Sex) + Dom 15h-20h' :
                         selectedCandidate.schedule_option === 'opcao3' ? 'Turno 3: 13h - 20h (Seg-Sex) + Dom 10h-15h' :
                         'Horário a definir'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Links Profissionais */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Portfólio & Redes</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <a href={selectedCandidate.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
                      <Linkedin className="w-4 h-4 text-blue-500" />
                      <span className="text-[10px] font-bold text-white/80">LinkedIn</span>
                    </a>
                    {selectedCandidate.github_url && (
                      <a href={selectedCandidate.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all group">
                        <Github className="w-4 h-4 text-white" />
                        <span className="text-[10px] font-bold text-white/80">GitHub</span>
                      </a>
                    )}
                    {selectedCandidate.portfolio_url && (
                      <a href={selectedCandidate.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                        <Globe className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-bold text-white/80">Portfólio</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Requisitos Checklist */}
                <div className="space-y-4 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="flex items-center justify-between border-b border-primary/10 pb-3 mb-1">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Checklist de Requisitos</h3>
                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-2.5 h-2.5" /> VERIFICADO
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Internet</span>
                      <div className="flex items-center gap-1.5">
                        {selectedCandidate.internet_stable === 'sim' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                        <span className="text-[10px] font-black text-white">{selectedCandidate.internet_stable === 'sim' ? 'ESTÁVEL' : 'INSTÁVEL'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Setup Vídeo</span>
                      <div className="flex items-center gap-1.5">
                        {selectedCandidate.webcam_ready === 'sim' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                        <span className="text-[10px] font-black text-white">{selectedCandidate.webcam_ready === 'sim' ? 'PRONTO' : 'PENDENTE'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Contrato US</span>
                      <div className="flex items-center gap-1.5">
                        {selectedCandidate.contract_agreement === 'sim' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                        <span className="text-[10px] font-black text-white">{selectedCandidate.contract_agreement === 'sim' ? 'ACEITO' : 'NÃO'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2">
                  <Button 
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-[0.2em] gap-3"
                    onClick={() => selectedCandidate.resume_url && openResume(selectedCandidate.resume_url)}
                  >
                    <FileDown className="w-5 h-5" />
                    Abrir Currículo PDF
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resume Viewer Modal */}
      <AnimatePresence>
        {isResumeModalOpen && resumeUrl && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
              onClick={() => setIsResumeModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-6xl h-[94vh] bg-[#050505] border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(131,52,255,0.2)] overflow-hidden flex flex-col z-10"
            >
              {/* Toolbar */}
              <div className="p-8 border-b border-white/5 bg-black/40 flex items-center justify-between backdrop-blur-md">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-black text-2xl text-white tracking-tight hidden sm:block">Visualizador de Documentos</h3>
                    <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">Currículo Profissional • PDF</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    className="text-white hover:bg-primary/20 h-14 px-8 font-black text-sm rounded-2xl border border-white/10 transition-all uppercase tracking-widest"
                    onClick={downloadResume}
                  >
                    <Download className="w-5 h-5 mr-3 text-primary" />
                    Baixar PDF
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-destructive/20 hover:text-destructive h-14 w-14 rounded-2xl border border-white/10 transition-all"
                    onClick={() => setIsResumeModalOpen(false)}
                  >
                    <X className="w-8 h-8" />
                  </Button>
                </div>
              </div>

              {/* Viewer */}
              <div className="flex-1 bg-zinc-950 overflow-hidden relative">
                <iframe 
                  src={`${resumeUrl}#toolbar=0`}
                  className="w-full h-full border-none"
                  title="PDF Viewer"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CandidatesManagement;
