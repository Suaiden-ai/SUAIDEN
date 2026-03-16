import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { jobsService, type Job } from "../../services/jobs";
import { localizeJob } from "../../utils/jobTranslations";
import { Badge } from "@/components/jobs/ui/badge";
import { Button } from "@/components/jobs/ui/button";
import {
  Globe,
  ArrowRight,
  Clock,
  Briefcase,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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

const JobPostingPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const data = await jobsService.getJobs();
        setJobsList(data);
      } catch (error) {
        console.error("Erro ao buscar vagas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  return (
    <div className="relative bg-background">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(210_100%_56%/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(210_100%_56%/0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-40 sm:pt-32 pb-24 sm:pb-32">

        {/* Hero Section */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="text-center mb-16">
          <Badge variant="tech" className="mb-6 text-sm px-4 py-1.5">
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            {t("jobs.posting.badge")}
          </Badge>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("jobs.posting.heroText")}
          </p>
        </motion.div>

        {/* Jobs List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6">
            {jobsList.map((job, i) => {
              const localizedJob = localizeJob(job, t);
              return (
                <motion.div
                  key={localizedJob.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i}
                  className="bg-card border border-border rounded-2xl p-6 sm:p-8 hover:border-primary/30 transition-all duration-300 group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                          {localizedJob.type}
                        </Badge>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground border-none">
                          {localizedJob.location}
                        </Badge>
                      </div>
                      <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {localizedJob.title}
                      </h3>
                      <p className="text-muted-foreground line-clamp-2 max-w-2xl">
                        {localizedJob.shortDescription}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {t("jobs.common.remote")}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4" />
                          {t("jobs.common.international")}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="hero"
                        className="rounded-xl px-8"
                        onClick={() => navigate(`/vaga/${localizedJob.slug}`)}
                      >
                        {t("jobs.posting.viewDetails")}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {jobsList.length === 0 && (
              <motion.p
                initial="hidden"
                whileInView="visible"
                variants={fadeUp}
                className="text-center text-muted-foreground mt-12 italic"
              >
                {t("jobs.posting.noJobs")}
              </motion.p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobPostingPage;
