import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { solidIcons } from '../../lib/icons';
import LeadForm from '../ui/LeadForm';
import { useLanguage } from '../../context/LanguageContext';

const HeroSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="relative pt-28 pb-20 md:pt-32 md:pb-24 overflow-hidden flex items-center min-h-[90vh]">
      
      <div className="container relative z-10">
        <div className="flex flex-col items-center text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6 max-w-2xl mx-auto"
          >
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="inline-flex items-center px-4 py-2 bg-dark-800/60 backdrop-blur-sm rounded-full text-sm text-white/80"
            >
              <FontAwesomeIcon icon={solidIcons.faStar} size="sm" className="mr-2 text-primary-400" />
              {t('hero.tagline')}
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight">
              {t('hero.title').split(' ').slice(0, -1).join(' ')}{" "}
              <motion.span 
                className="gradient-text neon-glow inline-block"
                animate={{ 
                  textShadow: [
                    "0 0 8px rgba(131, 52, 255, 0.7), 0 0 16px rgba(131, 52, 255, 0.3)",
                    "0 0 12px rgba(131, 52, 255, 0.9), 0 0 24px rgba(131, 52, 255, 0.5)",
                    "0 0 8px rgba(131, 52, 255, 0.7), 0 0 16px rgba(131, 52, 255, 0.3)"
                  ]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut" 
                }}
              >
                {t('hero.title').split(' ').pop()}
              </motion.span>
            </h1>
            
            <p className="text-xl text-white/80 max-w-xl mx-auto">
              {t('hero.description')}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-10 w-full max-w-lg"
          >
            <LeadForm className="shadow-[0_0_30px_rgba(154,103,255,0.15)] bg-dark-900/60 backdrop-blur-md" />
          </motion.div>
          
          <div className="flex justify-center flex-wrap gap-6 mt-8">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="flex items-center"
            >
              <FontAwesomeIcon icon={solidIcons.faBolt} size="sm" className="mr-2 text-primary-400" />
              <span className="text-white/70">{t('hero.features.fastImplementation')}</span>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.7 }}
              className="flex items-center"
            >
              <FontAwesomeIcon icon={solidIcons.faBrain} size="sm" className="mr-2 text-primary-400" />
              <span className="text-white/70">{t('hero.features.advancedAI')}</span>
            </motion.div>
          </div>
          
          <motion.div
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
            initial={{ y: 0, opacity: 0.3 }}
            animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
              <motion.div 
                className="w-1 h-2 bg-white/50 rounded-full"
                animate={{ y: [0, 3, 0] }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut" 
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;