import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, BookOpen, GraduationCap, Globe } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';

// Cases data will be generated from translations

const CasesSection: React.FC = () => {
  const { t } = useLanguage();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const cases = [
    {
      title: t('cases.case1.title'),
      description: t('cases.case1.description'),
      icon: BookOpen,
      results: t('cases.case1.results', { returnObjects: true }),
      image: '/the-futur.png',
      url: 'https://thefutureofenglish.com/'
    },
    {
      title: t('cases.case2.title'),
      description: t('cases.case2.description'),
      icon: Globe,
      results: t('cases.case2.results', { returnObjects: true }),
      image: '/lush-america.jpg',
      url: 'https://lushamerica.com/'
    },
    {
      title: t('cases.case3.title'),
      description: t('cases.case3.description'),
      icon: GraduationCap,
      results: t('cases.case3.results', { returnObjects: true }),
      image: '/matricula-usa.png',
      url: 'https://matriculausa.com/'
    }
  ];

  const handleViewDetails = (url: string) => {
    if (url.startsWith('#')) {
      // Navegação interna para seções da página
      const element = document.querySelector(url);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Link externo - abrir em nova aba
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  return (
    <section id="cases" className="py-20 relative overflow-hidden">
      {/* Background elements */}
      
      <div className="container relative">
        <SectionTitle
          title={t('cases.title')}
          subtitle={t('cases.subtitle')}
          center
          className="mb-16"
        />
        
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {cases.map((caseItem, index) => {
            const Icon = caseItem.icon;
            
            return (
              <motion.div key={index} variants={itemVariants}>
                <Card className="h-full flex flex-col overflow-hidden">
                  <div className="h-48 -mx-6 -mt-6 mb-6 overflow-hidden">
                    <img 
                      src={caseItem.image} 
                      alt={caseItem.title} 
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                    />
                  </div>
                  
                  <div className="flex items-center mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 mr-3">
                      <Icon size={18} className="text-primary-400" />
                    </div>
                    <h3 className="text-xl font-display font-medium">{caseItem.title}</h3>
                  </div>
                  
                  <p className="text-white/70 mb-4">{caseItem.description}</p>
                  
                  <div className="mt-auto">
                    <h4 className="text-sm font-medium uppercase text-primary-400 mb-2">Resultados:</h4>
                    <ul className="space-y-2 mb-4">
                      {caseItem.results.map((result, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-primary-400 mr-2">•</span>
                          <span className="text-white/80 text-sm">{result}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 group"
                      onClick={() => handleViewDetails(caseItem.url)}
                    >
                      {t('cases.viewDetails')}
                      <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default CasesSection;