import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { LineChart, Lock, Rocket, ShieldCheck, Timer } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import { useLanguage } from '../../context/LanguageContext';

// Benefits data will be generated from translations

const BenefitsSection: React.FC = () => {
  const { t } = useLanguage();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const benefits = [
    {
      title: t('benefits.benefit1.title'),
      description: t('benefits.benefit1.description'),
      icon: Rocket
    },
    {
      title: t('benefits.benefit2.title'),
      description: t('benefits.benefit2.description'),
      icon: Timer
    },
    {
      title: t('benefits.benefit3.title'),
      description: t('benefits.benefit3.description'),
      icon: LineChart
    },
    {
      title: t('benefits.benefit4.title'),
      description: t('benefits.benefit4.description'),
      icon: ShieldCheck
    },
    {
      title: t('benefits.benefit5.title'),
      description: t('benefits.benefit5.description'),
      icon: Lock
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
    <section className="py-20 relative overflow-hidden">
      {/* Background elements */}
      
      <div className="container relative">
        <SectionTitle
          title={t('benefits.title')}
          center
          className="mb-16"
        />
        
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6"
        >
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            
            return (
              <motion.div 
                key={index} 
                variants={itemVariants}
                className="flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-4">
                  <Icon size={24} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-display font-medium mb-2">{benefit.title}</h3>
                <p className="text-white/70 text-sm">{benefit.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default BenefitsSection;