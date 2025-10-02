import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, BookOpen, GraduationCap, Globe } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import Card from '../ui/Card';
import Button from '../ui/Button';

const cases = [
  {
    title: 'The Future of English',
    description: 'Desenvolvemos uma plataforma digital inovadora para facilitar a tradução de documentos em diferentes idiomas com o apoio da Inteligência Artificial, oferecendo uma experiência simples, rápida e confiável para pessoas e empresas.',
    icon: BookOpen,
    results: ['Redução de 85% no tempo de tradução', 'Aumento de 90% na precisão das traduções', 'Atendimento a mais de 2.000 usuários mensalmente'],
    image: '/the-futur.png',
    url: 'https://thefutureofenglish.com/' // Link direto para o projeto real
  },
  {
    title: 'Lush America Translations',
    description: 'Desenvolvemos uma plataforma inovadora de tradução de documentos oficiais e acadêmicos utilizando Inteligência Artificial de ponta, garantindo traduções rápidas, consistentes e seguras para diversos idiomas.',
    icon: Globe,
    results: ['Redução de 80% no tempo de tradução', 'Aumento de 95% na precisão das traduções', 'Atendimento a mais de 1.000 usuários mensalmente'],
    image: '/lush-america.jpg',
    url: 'https://lushamerica.com/' // Link direto para o projeto real
  },
  {
    title: 'Matricula USA',
    description: 'Desenvolvemos a plataforma Matrícula USA, uma solução completa para estudantes internacionais que buscam oportunidades de estudo nos Estados Unidos, simplificando todo o processo de admissão.',
    icon: GraduationCap,
    results: ['Redução de 80% no tempo de pesquisa de bolsas', 'Aumento de 65% na taxa de aplicações bem-sucedidas', 'Atendimento a mais de 10.000 estudantes mensalmente'],
    image: '/matricula-usa.png',
    url: 'https://matriculausa.com/' // Link direto para o projeto real
  }
];

const CasesSection: React.FC = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

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
          title="NOSSOS PROJETOS REAIS COM RESULTADOS CONCRETOS"
          subtitle="Conheça alguns dos projetos que desenvolvemos e os resultados mensuráveis que ajudamos nossos clientes a alcançar."
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
                      Ver detalhes
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