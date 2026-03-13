import { motion } from "framer-motion";
import { Badge } from "@/components/jobs/ui/badge";
import { Button } from "@/components/jobs/ui/button";
import { Input } from "@/components/jobs/ui/input";
import { Label } from "@/components/jobs/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/jobs/ui/radio-group";
import {
  ArrowLeft,
  Send,
  User,
  Mail,
  Phone,
  Wifi,
  FileText,
  Camera,
  Clock,
  Linkedin,
  ClipboardCheck,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { jobs } from "../../data/jobs";
import { useToast } from "@/hooks/jobs/use-toast";
import { supabase } from "@/services/supabase";
import { emailService } from "@/services/email";

import type { Easing } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: "easeOut" as Easing },
  }),
};

const ApplicationFormPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const job = jobs.find(j => j.slug === slug);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [stableInternet, setStableInternet] = useState("");
  const [understandsContract, setUnderstandsContract] = useState("");
  const [hasWebcam, setHasWebcam] = useState("");
  const [schedule, setSchedule] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [resume, setResume] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !whatsapp || !stableInternet || !understandsContract || !hasWebcam || !schedule || !resume) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios, incluindo o currículo.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let resumePath = null;
      if (resume) {
        const fileExt = resume.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
        const filePath = `${Date.now()}-${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('curriculum-vitae')
          .upload(filePath, resume);

        if (uploadError) throw uploadError;
        resumePath = filePath;
      }

      const { error, data } = await supabase.from("job_applications").insert({
        full_name: name,
        email,
        whatsapp,
        internet_stable: stableInternet,
        contract_agreement: understandsContract,
        webcam_ready: hasWebcam,
        schedule_option: schedule,
        linkedin_url: linkedin,
        job_slug: slug,
        job_title: job?.title,
        resume_url: resumePath
      }).select();

      if (error) throw error;

      // --- Notificações por E-mail ---
      try {
        const applicationData = data[0];
        
        // 1. Notificar Candidato
        await emailService.sendCandidateConfirmation(email, name, job?.title || "Vaga");

        // 2. Notificar Administradores
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email')
          .eq('role', 'admin');

        if (adminProfiles && adminProfiles.length > 0) {
          await Promise.all(
            adminProfiles
              .filter(profile => profile.email) // Garantir que tem e-mail
              .map(profile => 
                emailService.sendAdminNotification(profile.email, {
                  fullName: name,
                  email: email,
                  jobTitle: job?.title || "Vaga",
                  id: applicationData.id
                })
              )
          );
        }
      } catch (emailError) {
        console.error("Erro ao enviar notificações:", emailError);
        // Não travamos o fluxo se o e-mail falhar, pois os dados já foram salvos
      }

      toast({
        title: "Candidatura enviada com sucesso!",
        description: "Entraremos em contato em breve. Obrigado!",
      });
      
      setTimeout(() => navigate("/"), 2000);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(hsl(210_100%_56%/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(210_100%_56%/0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Back */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <Button
            variant="ghost"
            className="mb-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="text-center mb-14">
          <Badge variant="tech" className="mb-6 text-sm px-4 py-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
            Candidatura
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4 leading-tight">
            Candidatura para <span className="text-primary">{job?.title || "Vaga"}</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Preencha as informações abaixo para se candidatar à vaga.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit}>
          <motion.div
            initial="hidden"
            animate="visible"
            className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-8"
          >
            {/* Nome */}
            <motion.div variants={fadeUp} custom={1} className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <User className="w-4 h-4 text-primary" />
                Qual seu nome completo? <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted border-border"
              />
            </motion.div>

            {/* Email */}
            <motion.div variants={fadeUp} custom={2} className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <Mail className="w-4 h-4 text-primary" />
                Qual seu e-mail? <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-muted border-border"
              />
            </motion.div>

            {/* WhatsApp */}
            <motion.div variants={fadeUp} custom={3} className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <Phone className="w-4 h-4 text-primary" />
                Qual seu WhatsApp? <span className="text-destructive">*</span>
              </Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="bg-muted border-border"
              />
            </motion.div>

            {/* Internet estável */}
            <motion.div variants={fadeUp} custom={4} className="space-y-3">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <Wifi className="w-4 h-4 text-primary" />
                Você tem conexão estável com a internet? <span className="text-destructive">*</span>
              </Label>
              <RadioGroup value={stableInternet} onValueChange={setStableInternet} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="internet-sim" />
                  <Label htmlFor="internet-sim" className="text-card-foreground cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="internet-nao" />
                  <Label htmlFor="internet-nao" className="text-card-foreground cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </motion.div>

            {/* Entende o contrato */}
            <motion.div variants={fadeUp} custom={5} className="space-y-3">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <FileText className="w-4 h-4 text-primary" />
                Modelo de contrato <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Esta vaga <strong className="text-foreground">não é CLT</strong>. O contrato segue as normas americanas do estado do Arizona (EUA), 
                e os feriados seguem o calendário americano. Você entende e concorda com esse modelo?
              </p>
              <RadioGroup value={understandsContract} onValueChange={setUnderstandsContract} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="contrato-sim" />
                  <Label htmlFor="contrato-sim" className="text-card-foreground cursor-pointer">Sim, entendo e concordo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="contrato-nao" />
                  <Label htmlFor="contrato-nao" className="text-card-foreground cursor-pointer">Não concordo</Label>
                </div>
              </RadioGroup>
            </motion.div>

            {/* Webcam */}
            <motion.div variants={fadeUp} custom={6} className="space-y-3">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <Camera className="w-4 h-4 text-primary" />
                Você tem webcam e microfone para reuniões diárias via Zoom? <span className="text-destructive">*</span>
              </Label>
              <RadioGroup value={hasWebcam} onValueChange={setHasWebcam} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="webcam-sim" />
                  <Label htmlFor="webcam-sim" className="text-card-foreground cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="webcam-nao" />
                  <Label htmlFor="webcam-nao" className="text-card-foreground cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </motion.div>

            {/* Horários */}
            <motion.div variants={fadeUp} custom={7} className="space-y-3">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <Clock className="w-4 h-4 text-primary" />
                Quais horários você tem disponibilidade para trabalhar? (40h semanais) <span className="text-destructive">*</span>
              </Label>
              <RadioGroup value={schedule} onValueChange={setSchedule} className="space-y-3">
                <div className="flex items-start gap-3 bg-muted/50 border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <RadioGroupItem value="opcao1" id="horario-1" className="mt-0.5" />
                  <Label htmlFor="horario-1" className="text-card-foreground cursor-pointer leading-relaxed">
                    <strong>Opção 1:</strong> 13h às 20h (seg a sexta) / Sábado 10h às 15h
                  </Label>
                </div>
                <div className="flex items-start gap-3 bg-muted/50 border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <RadioGroupItem value="opcao2" id="horario-2" className="mt-0.5" />
                  <Label htmlFor="horario-2" className="text-card-foreground cursor-pointer leading-relaxed">
                    <strong>Opção 2:</strong> 10h às 17h (seg a sexta) / Domingo 15h às 20h
                  </Label>
                </div>
                <div className="flex items-start gap-3 bg-muted/50 border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <RadioGroupItem value="opcao3" id="horario-3" className="mt-0.5" />
                  <Label htmlFor="horario-3" className="text-card-foreground cursor-pointer leading-relaxed">
                    <strong>Opção 3:</strong> 13h às 20h (seg a sexta) / Domingo 10h às 15h
                  </Label>
                </div>
              </RadioGroup>
            </motion.div>

            {/* Currículo */}
            <motion.div variants={fadeUp} custom={8} className="space-y-4">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <FileText className="w-4 h-4 text-primary" />
                Envie seu currículo (PDF) <span className="text-destructive">*</span>
              </Label>
              
              <div className="flex justify-center">
                <label 
                  htmlFor="file-upload" 
                  className="group relative w-full flex flex-col items-center justify-center bg-[#1e1e1e] hover:bg-[#252525] p-10 rounded-[40px] border-2 border-dashed border-[#666] hover:border-primary/50 transition-all cursor-pointer shadow-[0_0_200px_-50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                    <svg viewBox="0 0 640 512" className="h-12 w-auto fill-[#666] group-hover:fill-primary transition-colors mb-5">
                      <path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-217c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l39-39V392c0 13.3 10.7 24 24 24s24-10.7 24-24V257.9l39 39c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-80-80c-9.4-9.4-24.6-9.4-33.9 0l-80 80z" />
                    </svg>
                    <p className="text-[#eee] font-medium leading-tight">
                      {resume ? resume.name : "Arraste e Solte"}
                    </p>
                    <p className="text-[#eee] text-sm opacity-60 italic">ou</p>
                    <span className="mt-1 bg-[#666] group-hover:bg-[#888] px-4 py-1.5 rounded-xl text-[#eee] group-hover:text-white text-sm font-medium transition-all">
                      {resume ? "Alterar Arquivo" : "Procurar Arquivo"}
                    </span>
                  </div>
                  <input 
                    id="file-upload" 
                    type="file" 
                    className="hidden" 
                    accept=".pdf"
                    onChange={(e) => setResume(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </motion.div>

            {/* LinkedIn */}
            <motion.div variants={fadeUp} custom={9} className="space-y-2">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <Linkedin className="w-4 h-4 text-primary" />
                Seu LinkedIn (opcional)
              </Label>
              <Input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="bg-muted border-border"
              />
            </motion.div>

            <motion.div variants={fadeUp} custom={10} className="pt-4">
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Enviando..." : "Enviar Candidatura"}
              </Button>
            </motion.div>
          </motion.div>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-12">
          © 2026 • Vaga remota com contrato direto com empresa americana
        </p>
      </div>
    </div>
  );
};

export default ApplicationFormPage;
