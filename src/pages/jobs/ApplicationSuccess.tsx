import { motion } from "framer-motion";
import { Button } from "@/components/jobs/ui/button";
import { Badge } from "@/components/jobs/ui/badge";
import { CheckCircle2, Home, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.8, ease: "easeOut" },
  }),
};

const ApplicationSuccessPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-20 px-4">
      <div className="relative max-w-2xl w-full">
        {/* Glow Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10" />
        
        <div className="text-center space-y-10">
          {/* Animated Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative bg-background border border-primary/30 w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl">
                <CheckCircle2 className="w-12 h-12 text-primary" />
              </div>
            </div>
          </motion.div>

          {/* Text Content */}
          <div className="space-y-4">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
              <Badge variant="tech" className="px-4 py-1.5 bg-primary/10 text-primary border-primary/20 mb-4">
                {t("jobs.success.badge")}
              </Badge>
            </motion.div>
            
            <motion.h1 
              initial="hidden" animate="visible" variants={fadeUp} custom={2}
              className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight"
            >
              {t("jobs.success.title")} <span className="text-primary">{t("jobs.success.confirmed")}</span>
            </motion.h1>
            
            <motion.p 
              initial="hidden" animate="visible" variants={fadeUp} custom={3}
              className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto"
            >
              {t("jobs.success.description")}
            </motion.p>
          </div>


          {/* Action Buttons */}
           <motion.div 
            initial="hidden" animate="visible" variants={fadeUp} custom={5}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Button 
              size="lg" 
              variant="hero" 
              className="w-full sm:w-auto px-10 h-14 rounded-2xl text-lg group"
              onClick={() => navigate("/")}
            >
              <Home className="w-5 h-5 mr-2" />
              {t("jobs.success.backHome")}
            </Button>
            <Button 
              size="lg" 
              variant="ghost" 
              className="w-full sm:w-auto h-14 rounded-2xl text-muted-foreground hover:text-white"
              onClick={() => navigate("/vagas")}
            >
              {t("jobs.success.seeOther")}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationSuccessPage;
