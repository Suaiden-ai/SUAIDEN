import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { LineChart, Lock, Rocket, ShieldCheck, Timer } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';

const benefits = [
  {
    title: 'Produtividade imediata',
    description: 'Implantação rápida que começa a gerar resultados desde os primeiros dias de uso.',
    icon: Rocket
  },
  {
    title: 'Atendimento 24/7 com IA',
    description: 'Nunca mais perca um cliente. Nossa IA atende a qualquer hora sem necessidade de equipe adicional.',
    icon: Timer
  },
  {
    title: 'Decisões baseadas em dados',
    description: 'Dashboards inteligentes que transformam dados em insights acionáveis para seu negócio.',
    icon: LineChart
  },
  {
    title: 'Automação escalável',
    description: 'Sistemas que crescem com sua empresa, sem necessidade de grandes investimentos adicionais.',
    icon: ShieldCheck
  },
  {
    title: 'Segurança e personalização',
    description: 'Toda a proteção que seus dados precisam, com soluções adaptadas exclusivamente ao seu negócio.',
    icon: Lock
  }
];

const BenefitsSection: React.FC = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

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
      <div className="absolute -top-40 right-20 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl -z-10"></div>
      <div className="absolute -bottom-40 left-20 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl -z-10"></div>
      
      <div className="container relative">
        <SectionTitle
          title="O que sua empresa ganha com a SUAIDEN"
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