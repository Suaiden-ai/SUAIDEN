import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Brain, Clock, Code2, HeartHandshake, RefreshCw } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';

const advantages = [
  {
    title: 'Projetos com IA real aplicada',
    description: 'Não apenas falamos de IA, implementamos soluções reais que geram resultados tangíveis para o seu negócio.',
    icon: Brain
  },
  {
    title: 'Desenvolvimento rápido e iterativo',
    description: 'Metodologia ágil com entregas contínuas, permitindo que você veja resultados desde o início do projeto.',
    icon: Clock
  },
  {
    title: 'Equipe experiente e multidisciplinar',
    description: 'Profissionais especialistas em IA, desenvolvimento e automação, prontos para resolver seus desafios.',
    icon: Code2
  },
  {
    title: 'Suporte e evolução contínuos',
    description: 'Oferecemos suporte constante e atualizações para garantir que sua solução evolua junto com seu negócio.',
    icon: RefreshCw
  },
  {
    title: 'Integração com suas ferramentas atuais',
    description: 'Nossas soluções se integram perfeitamente com as ferramentas que você já utiliza, sem necessidade de mudanças drásticas.',
    icon: HeartHandshake
  }
];

const AdvantagesSection: React.FC = () => {
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
    <section id="vantagens" className="py-20 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute -top-40 left-20 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 right-20 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl"></div>
      
      <div className="container relative">
        <SectionTitle
          title="Por que escolher a SUAIDEN?"
          subtitle="Entregamos soluções de IA e automação que realmente funcionam e geram resultados concretos para o seu negócio."
          center
          className="mb-16"
        />
        
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {advantages.map((advantage, index) => {
            const Icon = advantage.icon;
            
            return (
              <motion.div 
                key={index} 
                variants={itemVariants}
                className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-xl p-6 hover:border-primary-700/50 transition-colors duration-300"
              >
                <div className="flex">
                  <div className="mr-4 p-3 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 h-fit">
                    <Icon size={20} className="text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-medium mb-2">{advantage.title}</h3>
                    <p className="text-white/70 text-sm">{advantage.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default AdvantagesSection;