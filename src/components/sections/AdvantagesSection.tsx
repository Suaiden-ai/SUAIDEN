import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Brain, Clock, Code2, HeartHandshake, RefreshCw } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import { useLanguage } from '../../context/LanguageContext';

// Advantages data will be generated from translations

const AdvantagesSection: React.FC = () => {
  const { t } = useLanguage();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const advantages = [
    {
      title: t('advantages.advantage1.title'),
      description: t('advantages.advantage1.description'),
      icon: Brain
    },
    {
      title: t('advantages.advantage2.title'),
      description: t('advantages.advantage2.description'),
      icon: Clock
    },
    {
      title: t('advantages.advantage3.title'),
      description: t('advantages.advantage3.description'),
      icon: Code2
    },
    {
      title: t('advantages.advantage4.title'),
      description: t('advantages.advantage4.description'),
      icon: RefreshCw
    },
    {
      title: t('advantages.advantage5.title'),
      description: t('advantages.advantage5.description'),
      icon: HeartHandshake
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  return (
    <section id="vantagens" className="py-20 relative overflow-hidden">
      {/* Background elements */}
      
      <div className="container relative">
        <SectionTitle
          title={t('advantages.title')}
          subtitle={t('advantages.subtitle')}
          center
          className="mb-16"
        />
        
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {/* Primeiros 3 cards */}
          {advantages.slice(0, 3).map((advantage, index) => {
            const Icon = advantage.icon;
            
            return (
              <motion.div 
                key={index} 
                variants={itemVariants}
                className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-xl p-6 hover:border-primary-700/50 hover:bg-dark-900/70 transition-all duration-300 group"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start mb-4">
                    <div className="mr-4 p-3 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 h-fit group-hover:from-primary-500/30 group-hover:to-accent-500/30 transition-all duration-300">
                      <Icon size={20} className="text-primary-400 group-hover:text-primary-300 transition-colors duration-300" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-display font-medium mb-2 text-white group-hover:text-primary-100 transition-colors duration-300">{advantage.title}</h3>
                    </div>
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed group-hover:text-white/80 transition-colors duration-300">{advantage.description}</p>
                </div>
              </motion.div>
            );
          })}
          
          {/* Container centralizado para os últimos 2 cards */}
          <div className="lg:col-span-3 flex justify-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              {advantages.slice(3).map((advantage, index) => {
                const Icon = advantage.icon;
                const actualIndex = index + 3; // Ajustar índice para animação
                
                return (
                  <motion.div 
                    key={actualIndex} 
                    variants={itemVariants}
                    className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-xl p-6 hover:border-primary-700/50 hover:bg-dark-900/70 transition-all duration-300 group"
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-start mb-4">
                        <div className="mr-4 p-3 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 h-fit group-hover:from-primary-500/30 group-hover:to-accent-500/30 transition-all duration-300">
                          <Icon size={20} className="text-primary-400 group-hover:text-primary-300 transition-colors duration-300" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-display font-medium mb-2 text-white group-hover:text-primary-100 transition-colors duration-300">{advantage.title}</h3>
                        </div>
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed group-hover:text-white/80 transition-colors duration-300">{advantage.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AdvantagesSection;