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
  FileDown
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
  internet_stable: string;
  contract_agreement: string;
  webcam_ready: string;
  schedule_option: string;
}

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
        
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white/[0.03] p-2 rounded-[2rem] border border-white/5 backdrop-blur-sm">
          <div className="relative group w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary transition-all duration-300 group-focus-within:scale-110 shadow-[0_0_15px_rgba(131,52,255,0.4)]" />
            <Input 
              placeholder="Buscar por nome ou e-mail..." 
              className="pl-14 pr-6 h-16 w-full sm:w-[350px] bg-black/40 border-white/10 rounded-[1.5rem] focus:border-primary/50 focus:ring-primary/20 text-lg transition-all font-medium text-white placeholder:text-muted-foreground"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-full sm:w-[220px] bg-black/40 border-white/10 hover:border-primary/40 transition-all h-16 rounded-[1.5rem] text-lg px-6 focus:ring-primary/20 text-white font-bold flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <Filter className="w-5 h-5 text-primary shrink-0" />
                <div className="truncate">
                  <SelectValue placeholder="Filtrar por vaga" />
                </div>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#0f0f0f] border-white/10 shadow-2xl p-2 rounded-2xl ring-1 ring-primary/20">
              <SelectItem value="all" className="focus:bg-primary/20 focus:text-white cursor-pointer py-3.5 rounded-xl text-muted-foreground font-bold hover:text-white transition-colors">
                Todas as Vagas
              </SelectItem>
              {jobsList.map(job => (
                <SelectItem 
                  key={job.id} 
                  value={job.slug}
                  className="focus:bg-primary/20 focus:text-white cursor-pointer py-3.5 rounded-xl text-muted-foreground font-bold hover:text-white transition-colors"
                >
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List Content */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/60 border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-xl group hover:border-primary/20 transition-all duration-500"
      >
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary/5 border-b border-white/10">
                <th className="px-10 py-7 text-xs font-black uppercase tracking-[0.2em] text-primary/70">Talento</th>
                <th className="px-10 py-7 text-xs font-black uppercase tracking-[0.2em] text-primary/70">Oportunidade</th>
                <th className="px-10 py-7 text-xs font-black uppercase tracking-[0.2em] text-primary/70 hidden md:table-cell">Registrado em</th>
                <th className="px-10 py-7 text-xs font-black uppercase tracking-[0.2em] text-primary/70 w-64 text-center">Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-10 py-10"><div className="h-4 bg-primary/10 rounded-full w-full" /></td>
                  </tr>
                ))
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mb-6 border border-primary/10 scale-110">
                        <Search className="w-10 h-10 text-primary opacity-40" />
                      </div>
                      <p className="text-2xl font-black text-white tracking-tight">Nenhum talento encontrado</p>
                      <p className="text-muted-foreground mt-2 text-lg">Tente ajustar seus termos de busca ou filtros.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((c) => (
                  <motion.tr 
                    key={c.id} 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-primary/[0.03] transition-all duration-300 group/row"
                  >
                    <td className="px-10 py-8">
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-xl text-white group-hover/row:text-primary transition-colors duration-300">{c.full_name}</span>
                        <span className="text-sm font-medium text-muted-foreground group-hover/row:text-muted-foreground/80">{c.email}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <Badge variant="outline" className="font-black text-[10px] uppercase tracking-widest border-primary/30 bg-primary/10 text-primary px-4 py-1.5 rounded-full shadow-[0_0_10px_rgba(131,52,255,0.1)]">
                        {c.job_title}
                      </Badge>
                    </td>
                    <td className="px-10 py-8 hidden md:table-cell">
                      <div className="flex items-center text-base text-muted-foreground gap-3 font-bold group-hover/row:text-white transition-colors">
                        <Calendar className="w-5 h-5 text-primary/60" />
                        {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center flex justify-center">
                      <div className="flex items-center gap-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-12 px-6 text-muted-foreground hover:bg-primary/10 hover:text-white border border-transparent hover:border-primary/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300"
                          onClick={() => setSelectedCandidate(c)}
                        >
                          <Eye className="w-4 h-4 mr-2 text-primary" />
                          Detalhes
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-12 px-6 border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-500 shadow-lg shadow-primary/5"
                          onClick={() => c.resume_url && openResume(c.resume_url)}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          CV
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

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
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-[3.5rem] shadow-[0_0_100px_rgba(131,52,255,0.15)] relative z-10 overflow-hidden"
            >
              <div className="p-12 border-b border-white/5 bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight text-white">{selectedCandidate.full_name}</h2>
                    <div className="flex items-center gap-3 mt-3">
                      <Badge className="bg-primary hover:bg-primary text-white font-black px-4 py-1.5 rounded-full text-xs">Candidato Selecionado</Badge>
                      <p className="text-primary font-black text-xl tracking-tighter">{selectedCandidate.job_title}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full w-14 h-14 border border-white/10 hover:bg-white/10 hover:scale-110 transition-all text-white" 
                    onClick={() => setSelectedCandidate(null)}
                  >
                    <X className="w-7 h-7" />
                  </Button>
                </div>
              </div>

              <div className="p-12 space-y-12 max-h-[65vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Informações de Contato</h3>
                    <div className="space-y-6">
                      <div className="flex items-center gap-5 text-lg font-bold text-white group cursor-pointer hover:translate-x-2 transition-transform">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                          <Mail className="w-6 h-6 text-primary" />
                        </div>
                        {selectedCandidate.email}
                      </div>
                      <div className="flex items-center gap-5 text-lg font-bold text-white group cursor-pointer hover:translate-x-2 transition-transform">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                          <Phone className="w-6 h-6 text-primary" />
                        </div>
                        {selectedCandidate.whatsapp}
                      </div>
                      {selectedCandidate.linkedin_url && (
                        <a 
                          href={selectedCandidate.linkedin_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-5 text-lg font-bold text-white hover:text-primary transition-all group hover:translate-x-2"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-all">
                            <Linkedin className="w-6 h-6 text-primary" />
                          </div>
                          Perfil Profissional
                          <ExternalLink className="w-5 h-5 ml-2 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Disponibilidade e Turno</h3>
                    <div className="p-8 bg-white/[0.03] rounded-[2.5rem] border border-white/5 space-y-4 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12" />
                      <div className="flex gap-5">
                        <div className="w-14 h-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                          <Clock className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-lg font-bold leading-snug text-white/90">
                          {selectedCandidate.schedule_option === 'opcao1' ? 'Turno 1: 13h - 20h (Seg-Sex) + Sáb 10h-15h' :
                           selectedCandidate.schedule_option === 'opcao2' ? 'Turno 2: 10h - 17h (Seg-Sex) + Dom 15h-20h' :
                           selectedCandidate.schedule_option === 'opcao3' ? 'Turno 3: 13h - 20h (Seg-Sex) + Dom 10h-15h' :
                           selectedCandidate.schedule_option}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-12 border-t border-white/5">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Status dos Requisitos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-8 bg-gradient-to-b from-white/[0.03] to-transparent rounded-[2.5rem] border border-white/5 flex flex-col items-center text-center group hover:border-primary/20 transition-all duration-300">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Conexão Estável</span>
                      <Badge variant={selectedCandidate.internet_stable === 'sim' ? 'default' : 'destructive'} className="h-10 px-6 font-black rounded-xl text-xs shadow-lg">
                        {selectedCandidate.internet_stable === 'sim' ? 'VERIFICADA' : 'INCONSISTENTE'}
                      </Badge>
                    </div>
                    <div className="p-8 bg-gradient-to-b from-white/[0.03] to-transparent rounded-[2.5rem] border border-white/5 flex flex-col items-center text-center group hover:border-primary/20 transition-all duration-300">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Setup Vídeo/Áudio</span>
                      <Badge variant={selectedCandidate.webcam_ready === 'sim' ? 'default' : 'destructive'} className="h-10 px-6 font-black rounded-xl text-xs shadow-lg">
                        {selectedCandidate.webcam_ready === 'sim' ? 'PRONTO' : 'PENDENTE'}
                      </Badge>
                    </div>
                    <div className="p-8 bg-gradient-to-b from-white/[0.03] to-transparent rounded-[2.5rem] border border-white/5 flex flex-col items-center text-center group hover:border-primary/20 transition-all duration-300">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Contrato US</span>
                      <Badge variant={selectedCandidate.contract_agreement === 'sim' ? 'default' : 'destructive'} className="h-10 px-6 font-black rounded-xl text-xs shadow-lg">
                        {selectedCandidate.contract_agreement === 'sim' ? 'ACEITO' : 'RECUSADO'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button 
                    className="w-full h-20 bg-primary hover:bg-primary/90 text-white font-black text-xl rounded-[1.5rem] shadow-[0_15px_40px_rgba(131,52,255,0.3)] transition-all transform hover:-translate-y-1 active:scale-95 border-none uppercase tracking-widest"
                    onClick={() => selectedCandidate.resume_url && openResume(selectedCandidate.resume_url)}
                  >
                    <FileDown className="w-7 h-7 mr-4 animate-bounce" />
                    Analisar currículo completo
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
