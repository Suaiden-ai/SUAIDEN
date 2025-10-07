import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { solidIcons } from '../../lib/icons';
import SectionTitle from '../ui/SectionTitle';
import Button from '../ui/Button';
import SchedulingModal from '../ui/SchedulingModal';
import { useLanguage } from '../../context/LanguageContext';

// Services data will be generated from translations

const ServiceCard: React.FC<{
  service: any;
  index: number;
  t: (key: string) => string;
}> = ({ service, index, t }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Animation variants
  const cardVariants = {
    initial: { y: 50, opacity: 0 },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: { 
        duration: 0.5, 
        ease: "easeOut",
        delay: index * 0.1
      } 
    }
  };

  const iconMotion = {
    initial: { scale: 1 },
    hover: { 
      scale: 1.1,
      transition: { duration: 0.3, yoyo: Infinity, ease: "easeInOut" }
    }
  };
  
  return (
    <motion.div
      initial="initial"
      animate="animate"
      whileHover={{ y: -8, scale: 1.02 }}
      variants={cardVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative z-10 group"
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="relative h-full overflow-hidden">
        {/* Main Card */}
        <motion.div 
          className={`h-full w-full relative overflow-hidden rounded-3xl p-6 flex flex-col items-center
                        bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95
                        backdrop-blur-xl border border-white/10 transition-all duration-500 ease-in-out
                        group-hover:border-primary-400/40 group-hover:shadow-[0_0_60px_rgba(139,92,246,0.3)] group-hover:shadow-primary-500/30`}
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 rounded-3xl"></div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Card Header - Centered */}
            <div className="flex flex-col items-center text-center mb-6">
              <motion.div 
                variants={iconMotion}
                className={`p-4 rounded-xl bg-gradient-to-br from-primary-500/30 via-primary-600/20 to-primary-700/30 
                            border border-primary-400/40 shadow-lg shadow-primary-500/20 mb-4`}
              >
                <FontAwesomeIcon icon={service.icon} size="lg" className="text-primary-200" />
              </motion.div>
              
              <h3 
                className="text-xl font-display font-bold mb-3 text-white" 
                style={{ 
                  wordBreak: 'normal', 
                  overflowWrap: 'normal',
                  hyphens: 'none',
                  WebkitHyphens: 'none',
                  msHyphens: 'none'
                }}
              >
                {service.title}
              </h3>
              
              <div className="flex items-center justify-center text-sm text-primary-100 
                               bg-gradient-to-r from-primary-500/20 to-primary-600/20 
                               px-4 py-2 rounded-full border border-primary-400/30 
                               shadow-lg shadow-primary-500/10">
                <FontAwesomeIcon icon={solidIcons.faBolt} size="sm" className="mr-2 text-primary-200 flex-shrink-0" />
                <span 
                  className="font-semibold text-center" 
                  style={{ 
                    wordBreak: 'normal',
                    overflowWrap: 'break-word',
                    hyphens: 'auto',
                    WebkitHyphens: 'auto',
                    msHyphens: 'auto',
                    lineHeight: '1.4'
                  }}
                >
                  {service.benefits}
                </span>
              </div>
            </div>
            
            {/* Description - Left aligned */}
            <p 
              className="text-slate-200 mb-5 leading-relaxed text-sm text-left" 
              style={{ 
                wordBreak: 'break-word', 
                overflowWrap: 'break-word',
                hyphens: 'auto',
                WebkitHyphens: 'auto',
                msHyphens: 'auto'
              }}
            >
              {service.description}
            </p>
          
            {/* Features - Left aligned */}
            <div className="mt-auto space-y-3 w-full">
              <ul className="space-y-3 mb-5">
                {service.features.map((feature: any, idx: number) => (
                  <motion.li 
                    key={idx} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (idx * 0.1) }}
                    className="flex items-start"
                  >
                    <FontAwesomeIcon icon={solidIcons.faCheckCircle} size="sm" className="text-primary-300 mt-0.5 mr-3 flex-shrink-0" />
                    <span className="text-slate-100 text-sm font-semibold leading-relaxed">
                      {feature}
                    </span>
                  </motion.li>
                ))}
              </ul>
              
              
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const ServicesSection: React.FC = () => {
  const { t } = useLanguage();
  
  const services = [
    {
      title: t('services.automation.title'),
      description: t('services.automation.description'),
      longDescription: t('services.automation.longDescription'),
      icon: solidIcons.faRobot,
      color: 'from-primary-500/20 to-primary-700/20',
      features: t('services.automation.features', { returnObjects: true }),
      benefits: t('services.automation.benefits'),
      link: '#contato'
    },
    {
      title: t('services.ai.title'),
      description: t('services.ai.description'),
      longDescription: t('services.ai.longDescription'),
      icon: solidIcons.faTerminal,
      color: 'from-accent-500/20 to-accent-700/20',
      features: t('services.ai.features', { returnObjects: true }),
      benefits: t('services.ai.benefits'),
      link: '#contato'
    },
    {
      title: t('services.custom.title'),
      description: t('services.custom.description'),
      longDescription: t('services.custom.longDescription'),
      icon: solidIcons.faCode,
      color: 'from-secondary-500/20 to-secondary-700/20',
      features: t('services.custom.features', { returnObjects: true }),
      benefits: t('services.custom.benefits'),
      link: '#contato'
    },
    {
      title: t('services.data.title'),
      description: t('services.data.description'),
      longDescription: t('services.data.longDescription'),
      icon: solidIcons.faDatabase,
      color: 'from-primary-700/20 to-accent-700/20',
      features: t('services.data.features', { returnObjects: true }),
      benefits: t('services.data.benefits'),
      link: '#contato'
    }
  ];
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);

  const handleScheduleConsultation = (data: any) => {
    console.log('Agendamento solicitado:', data);
    // Feedback inline é exibido dentro do próprio modal; nada a fazer aqui.
  };

  return (
    <section id="servicos" className="py-20 relative overflow-hidden">
      {/* Background elements */}
      
      
      <div className="container relative max-w-8xl mx-auto px-4">
        <SectionTitle
          title={t('services.title')}
          subtitle={t('services.subtitle')}
          center
          className="mb-16"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-8xl mx-auto">
          {services.map((service, index) => (
            <ServiceCard key={index} service={service} index={index} t={t} />
          ))}
        </div>
        
        {/* Statistics Section */}
        <div className="mt-20 p-8 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl text-center shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-primary-300 text-4xl font-display font-bold">+120</div>
              <div className="text-slate-300 mt-2 font-medium">{t('services.stats.projects')}</div>
            </div>
            <div className="text-center">
              <div className="text-primary-300 text-4xl font-display font-bold">98%</div>
              <div className="text-slate-300 mt-2 font-medium">{t('services.stats.satisfied')}</div>
            </div>
            <div className="text-center">
              <div className="text-primary-300 text-4xl font-display font-bold">45%</div>
              <div className="text-slate-300 mt-2 font-medium">{t('services.stats.savings')}</div>
            </div>
            <div className="text-center">
              <div className="text-primary-300 text-4xl font-display font-bold">24/7</div>
              <div className="text-slate-300 mt-2 font-medium">{t('services.stats.support')}</div>
            </div>
          </div>
        </div>
        
        {/* CTA Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-20 text-center"
          ref={ref}
        >
          <div className="inline-block p-1.5 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 mb-6">
            <div className="bg-dark-950 rounded-full p-2">
              <FontAwesomeIcon icon={solidIcons.faLightbulb} size="lg" className="text-primary-400" />
            </div>
          </div>
          
          <h3 className="text-2xl md:text-3xl font-display font-medium mb-4 max-w-2xl mx-auto">
            {t('services.cta.title').split(' ').slice(0, -1).join(' ')} <span className="text-primary-400">{t('services.cta.title').split(' ').pop()}</span>?
          </h3>
          
          <p className="text-white/70 mb-8 max-w-xl mx-auto">
            {t('services.cta.subtitle')}
          </p>
          
          <Button 
            size="lg"
            className="group"
            onClick={() => setIsSchedulingModalOpen(true)}
          >
            {t('services.cta.button')}
            <FontAwesomeIcon icon={solidIcons.faArrowRight} size="sm" className="ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <div className="flex justify-center gap-3 mt-6">
            <div className="flex items-center">
              <FontAwesomeIcon icon={solidIcons.faCheckCircle} size="sm" className="text-primary-400 mr-1.5" />
              <span className="text-white/60 text-sm">{t('services.cta.features.noCommitment')}</span>
            </div>
            <div className="flex items-center">
              <FontAwesomeIcon icon={solidIcons.faCheckCircle} size="sm" className="text-primary-400 mr-1.5" />
              <span className="text-white/60 text-sm">{t('services.cta.features.personalizedService')}</span>
            </div>
          </div>
        </motion.div>
        {/* Scheduling Modal (mesmo da página Studio) */}
        <SchedulingModal
          isOpen={isSchedulingModalOpen}
          onClose={() => setIsSchedulingModalOpen(false)}
          onSchedule={handleScheduleConsultation}
        />
      </div>
    </section>
  );
};

export default ServicesSection;
