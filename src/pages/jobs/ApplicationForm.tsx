import { motion } from "framer-motion";
import { Badge } from "@/components/jobs/ui/badge";
import { Button } from "@/components/jobs/ui/button";
import { Input } from "@/components/jobs/ui/input";
import { Label } from "@/components/jobs/ui/label";
import { Checkbox } from "@/components/jobs/ui/checkbox";
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
  Github,
  Globe,
  ClipboardCheck,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import type { Job } from "../../services/jobs";
import { localizeJob } from "../../utils/jobTranslations";
import { useToast } from "@/hooks/jobs/use-toast";
import { supabase } from "@/services/supabase";
import { emailService } from "@/services/email";
import { useLanguage } from "../../context/LanguageContext";

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
  const params = useParams();
  const slug = params.slug || "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [job, setJob] = useState<Job | null>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar detalhes da vaga no banco
  useEffect(() => {
    const fetchJob = async () => {
      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("slug", slug)
          .single();

        if (error) throw error;
        setJob(data);
      } catch (err) {
        console.error("Erro ao carregar vaga:", err);
      } finally {
        setIsLoadingJob(false);
      }
    };

    if (slug) {
      fetchJob();
    }
  }, [slug]);
  
  const localizedJob = job ? localizeJob(job, t) : null;

  const [name, setName] = useState(() => localStorage.getItem("app_name") || "");
  const [email, setEmail] = useState(() => localStorage.getItem("app_email") || "");
  const [whatsapp, setWhatsapp] = useState(() => localStorage.getItem("app_whatsapp") || "");
  const [stableInternet, setStableInternet] = useState(() => localStorage.getItem("app_internet") || "");
  const [understandsContract, setUnderstandsContract] = useState(() => localStorage.getItem("app_contract") || "");
  const [hasWebcam, setHasWebcam] = useState(() => localStorage.getItem("app_webcam") || "");
  const [weekDaySchedules, setWeekDaySchedules] = useState<string[]>(() => {
    const saved = localStorage.getItem("app_weekday_schedules");
    return saved ? JSON.parse(saved) : [];
  });
  const [weekendSchedules, setWeekendSchedules] = useState<string[]>(() => {
    const saved = localStorage.getItem("app_weekend_schedules");
    return saved ? JSON.parse(saved) : [];
  });
  const [linkedin, setLinkedin] = useState(() => localStorage.getItem("app_linkedin") || "");
  const [portfolio, setPortfolio] = useState(() => localStorage.getItem("app_portfolio") || "");
  const [github, setGithub] = useState(() => localStorage.getItem("app_github") || "");
  const [resume, setResume] = useState<File | null>(null);

  // Efeito para persistir dados no LocalStorage
  useEffect(() => {
    localStorage.setItem("app_name", name);
    localStorage.setItem("app_email", email);
    localStorage.setItem("app_whatsapp", whatsapp);
    localStorage.setItem("app_internet", stableInternet);
    localStorage.setItem("app_contract", understandsContract);
    localStorage.setItem("app_webcam", hasWebcam);
    localStorage.setItem("app_weekday_schedules", JSON.stringify(weekDaySchedules));
    localStorage.setItem("app_weekend_schedules", JSON.stringify(weekendSchedules));
    localStorage.setItem("app_linkedin", linkedin);
    localStorage.setItem("app_portfolio", portfolio);
    localStorage.setItem("app_github", github);
  }, [name, email, whatsapp, stableInternet, understandsContract, hasWebcam, weekDaySchedules, weekendSchedules, linkedin, portfolio, github]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !whatsapp || !stableInternet || !understandsContract || !hasWebcam || weekDaySchedules.length === 0 || weekendSchedules.length === 0 || !resume) {
      toast({
        title: t("jobs.form.validationError"),
        description: t("jobs.form.validationDesc"),
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
        schedule_option: `Semana: ${weekDaySchedules.join(", ")} / Fim de Semana: ${weekendSchedules.join(", ")}`,
        linkedin_url: linkedin,
        portfolio_url: portfolio,
        github_url: github,
        job_slug: slug,
        job_title: localizedJob?.title || job?.title,
        resume_url: resumePath
      }).select();

      if (error) throw error;

      // --- Notificações por E-mail ---
      try {
        const applicationData = data[0];
        
        // 1. Notificar Candidato
        await emailService.sendCandidateConfirmation(email, name, localizedJob?.title || job?.title || "Vaga");

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
                  jobTitle: localizedJob?.title || job?.title || "Vaga",
                  id: applicationData.id
                })
              )
          );
        }
      } catch (emailError) {
        console.error("Erro ao enviar notificações:", emailError);
        // Não travamos o fluxo se o e-mail falhar, pois os dados já foram salvos
      }

      // Limpando o localStorage após sucesso
      localStorage.removeItem("app_name");
      localStorage.removeItem("app_email");
      localStorage.removeItem("app_whatsapp");
      localStorage.removeItem("app_internet");
      localStorage.removeItem("app_contract");
      localStorage.removeItem("app_webcam");
      localStorage.removeItem("app_weekday_schedules");
      localStorage.removeItem("app_weekend_schedules");
      localStorage.removeItem("app_linkedin");
      localStorage.removeItem("app_portfolio");
      localStorage.removeItem("app_github");

      navigate("/vaga/sucesso");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (isLoadingJob) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
            {t("jobs.common.back")}
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="text-center mb-14">
          <Badge variant="tech" className="mb-6 text-sm px-4 py-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
            {t("jobs.form.badge")}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4 leading-tight">
            {t("jobs.form.title")} <span className="text-primary">{localizedJob?.title || job?.title || "Vaga"}</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {t("jobs.form.subtitle")}
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
                {t("jobs.form.nameLabel")} <span className="text-destructive">*</span>
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
                {t("jobs.form.emailLabel")} <span className="text-destructive">*</span>
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
                {t("jobs.form.whatsappLabel")} <span className="text-destructive">*</span>
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
                {t("jobs.form.internetLabel")} <span className="text-destructive">*</span>
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
                {t("jobs.form.contractLabel")} <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("jobs.form.contractInfo")}
              </p>
              <RadioGroup value={understandsContract} onValueChange={setUnderstandsContract} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="contrato-sim" />
                  <Label htmlFor="contrato-sim" className="text-card-foreground cursor-pointer">{t("jobs.form.contractAgree")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="contrato-nao" />
                  <Label htmlFor="contrato-nao" className="text-card-foreground cursor-pointer">{t("jobs.form.contractDisagree")}</Label>
                </div>
              </RadioGroup>
            </motion.div>

            {/* Webcam */}
            <motion.div variants={fadeUp} custom={6} className="space-y-3">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <Camera className="w-4 h-4 text-primary" />
                {t("jobs.form.webcamLabel")} <span className="text-destructive">*</span>
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
            <motion.div variants={fadeUp} custom={7} className="space-y-8">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-primary font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t("jobs.form.scheduleTitle")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("jobs.form.scheduleInfo")}
                </p>
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-foreground font-medium text-lg">
                  <Clock className="w-5 h-5 text-primary" />
                  {t("jobs.form.weekdayLabel")} <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: "week-10-17", value: "10h às 17h" },
                    { id: "week-13-20", value: "13h às 20h" },
                    { id: "week-14-21", value: "14h às 21h" },
                  ].map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg p-4 hover:border-primary/30 transition-all group"
                    >
                      <Checkbox 
                        id={item.id} 
                        checked={weekDaySchedules.includes(item.value)}
                        onCheckedChange={(checked) => {
                          setWeekDaySchedules(prev => 
                            checked 
                              ? [...prev, item.value] 
                              : prev.filter(v => v !== item.value)
                          );
                        }}
                      />
                      <Label 
                        htmlFor={item.id} 
                        className="text-card-foreground cursor-pointer text-sm font-medium group-hover:text-primary transition-colors flex-1"
                      >
                        {item.value}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-foreground font-medium text-lg">
                  <Clock className="w-5 h-5 text-primary" />
                  {t("jobs.form.weekendLabel")} <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: "sat-10-15", value: "Sábado: 10h às 15h" },
                    { id: "sat-13-18", value: "Sábado: 13h às 18h" },
                    { id: "sun-10-15", value: "Domingo: 10h às 15h" },
                    { id: "sun-15-20", value: "Domingo: 15h às 20h" },
                  ].map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg p-4 hover:border-primary/30 transition-all group"
                    >
                      <Checkbox 
                        id={item.id} 
                        checked={weekendSchedules.includes(item.value)}
                        onCheckedChange={(checked) => {
                          setWeekendSchedules(prev => 
                            checked 
                              ? [...prev, item.value] 
                              : prev.filter(v => v !== item.value)
                          );
                        }}
                      />
                      <Label 
                        htmlFor={item.id} 
                        className="text-card-foreground cursor-pointer text-sm font-medium group-hover:text-primary transition-colors flex-1"
                      >
                        {item.value}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Currículo */}
            <motion.div variants={fadeUp} custom={8} className="space-y-4">
              <Label className="flex items-center gap-2 text-foreground font-medium">
                <FileText className="w-4 h-4 text-primary" />
                {t("jobs.form.resumeLabel")} <span className="text-destructive">*</span>
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
                      {resume ? resume.name : t("jobs.form.resumeDrop")}
                    </p>
                    <p className="text-[#eee] text-sm opacity-60 italic">{t("jobs.form.resumeOr")}</p>
                    <span className="mt-1 bg-[#666] group-hover:bg-[#888] px-4 py-1.5 rounded-xl text-[#eee] group-hover:text-white text-sm font-medium transition-all">
                      {resume ? t("jobs.form.resumeChange") : t("jobs.form.resumeBrowse")}
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
                {t("jobs.form.linkedinLabel")} {t("jobs.common.optional")}
              </Label>
              <Input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="bg-muted border-border"
              />
            </motion.div>

            {/* GitHub e Portfólio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <motion.div variants={fadeUp} custom={10} className="space-y-2">
                <Label className="flex items-center gap-2 text-foreground font-medium">
                  <Github className="w-4 h-4 text-primary" />
                  {t("jobs.form.githubLabel")} {t("jobs.common.optional")}
                </Label>
                <Input
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  className="bg-muted border-border"
                />
              </motion.div>

              <motion.div variants={fadeUp} custom={11} className="space-y-2">
                <Label className="flex items-center gap-2 text-foreground font-medium">
                  <Globe className="w-4 h-4 text-primary" />
                  {t("jobs.form.portfolioLabel")} {t("jobs.common.optional")}
                </Label>
                <Input
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  className="bg-muted border-border"
                />
              </motion.div>
            </div>

            <motion.div variants={fadeUp} custom={12} className="pt-4">
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? t("jobs.form.submitting") : t("jobs.form.submitButton")}
              </Button>
            </motion.div>
          </motion.div>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-12">
          {t("jobs.form.footer")}
        </p>
      </div>
    </div>
  );
};

export default ApplicationFormPage;
