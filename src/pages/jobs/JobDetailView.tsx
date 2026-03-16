import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { jobsService, getIcon, type Job } from "../../services/jobs";
import { localizeJob } from "../../utils/jobTranslations";
import { Badge } from "@/components/jobs/ui/badge";
import { Button } from "@/components/jobs/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Monitor,
  Users,
  Briefcase,
  Zap,
  Code2,
  CheckCircle2,
  Globe,
  DollarSign,
  Loader2
} from "lucide-react";
import type { Variants } from "framer-motion";
import { useLanguage } from "../../context/LanguageContext";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

const SectionTitle = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
  <motion.h2
    variants={fadeUp}
    custom={0}
    className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3"
  >
    <Icon className="w-6 h-6 text-primary" />
    {children}
  </motion.h2>
);

const JobDetailView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!slug) return;
      try {
        const data = await jobsService.getJobBySlug(slug);
        setJob(data);
      } catch (error) {
        console.error("Erro ao buscar vaga:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t("jobs.detail.notFound")}</h1>
          <Button onClick={() => navigate("/vagas")}>{t("jobs.detail.backToList")}</Button>
        </div>
      </div>
    );
  }

  const localizedJob = localizeJob(job, t);

  return (
    <div className="relative bg-background">
      <div className="absolute inset-0 bg-[linear-gradient(hsl(210_100%_56%/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(210_100%_56%/0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-40 sm:pt-32 pb-24 sm:pb-32">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <Button
            variant="ghost"
            className="mb-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/vagas")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("jobs.detail.backToList")}
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="text-center mb-16">
          <Badge variant="tech" className="mb-6 text-sm px-4 py-1.5">
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            {t("jobs.detail.remoteJob")} • {localizedJob.location}
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            {localizedJob.title}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {localizedJob.shortDescription}
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2 text-sm">
              <DollarSign className="w-4 h-4 text-primary" />
              {localizedJob.salary}
            </div>
            <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2 text-sm">
              <Briefcase className="w-4 h-4 text-primary" />
              {localizedJob.type}
            </div>
          </div>

          <div className="mt-10">
            <Button
              variant="hero"
              size="lg"
              className="px-10 py-6 text-lg rounded-xl animate-pulse-glow"
              onClick={() => navigate(`/vaga/${localizedJob.slug}/candidatar-se`)}
            >
              {t("jobs.detail.applyNow")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-16">
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <SectionTitle icon={Zap}>{t("jobs.detail.whyWorkWithUs")}</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-4">
              {localizedJob.benefits.map((benefit, i) => {
                const Icon = getIcon(benefit.icon_name);
                return (
                  <motion.div key={i} variants={fadeUp} custom={i + 1} className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors duration-300 group">
                    <Icon className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                    <p className="text-card-foreground font-medium">{benefit.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <SectionTitle icon={Code2}>{t("jobs.detail.techStack")}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {localizedJob.techStack.map((tag) => (
                <Badge key={tag} variant="tech" className="text-sm px-4 py-2">{tag}</Badge>
              ))}
            </div>
          </motion.section>

          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <SectionTitle icon={CheckCircle2}>{t("jobs.detail.requirements")}</SectionTitle>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              {localizedJob.requirements.map((req, i) => (
                <motion.div key={i} variants={fadeUp} custom={i + 1} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                  <p className="text-card-foreground">{req}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <SectionTitle icon={Briefcase}>{t("jobs.detail.responsibilities")}</SectionTitle>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              {localizedJob.responsibilities.map((item, i) => (
                <motion.div key={i} variants={fadeUp} custom={i + 1} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                  <p className="text-card-foreground">{item}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <SectionTitle icon={Monitor}>{t("jobs.detail.workEnvironment")}</SectionTitle>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              {localizedJob.workEnvironment.map((item, i) => {
                const Icon = getIcon(item.icon_name);
                return (
                  <motion.div key={i} variants={fadeUp} custom={i + 1} className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-card-foreground">{item.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <SectionTitle icon={DollarSign}>{t("jobs.detail.conditions")}</SectionTitle>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              {localizedJob.paymentTerms.map((item, i) => {
                const Icon = getIcon(item.icon_name);
                return (
                  <motion.div key={i} variants={fadeUp} custom={i + 1} className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-card-foreground">{item.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* Current Team */}
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <SectionTitle icon={Users}>{t("jobs.detail.currentTeam")}</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-4">
              {localizedJob.team.map((member, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 1}
                  className="bg-card border border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors duration-300 group"
                >
                  <Users className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-card-foreground font-medium">{member}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center bg-primary/5 border border-primary/20 rounded-2xl p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">{t("jobs.detail.readyNextStep")}</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t("jobs.detail.ctaText")}
            </p>
            <Button
              variant="hero"
              size="lg"
              className="px-10 py-6 text-lg rounded-xl animate-pulse-glow"
              onClick={() => navigate(`/vaga/${localizedJob.slug}/candidatar-se`)}
            >
              {t("jobs.detail.applyNow")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.section>
        </div>
      </div>
    </div>
  );
};

export default JobDetailView;
