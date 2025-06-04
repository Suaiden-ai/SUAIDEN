import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Building2, Gauge, ShoppingBag } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import Card from '../ui/Card';
import Button from '../ui/Button';

const cases = [
  {
    title: 'Clínica Médica Automatizada',
    description: 'Desenvolvemos um sistema de automação para uma clínica médica que reduziu o tempo de agendamento em 70% e melhorou a satisfação dos pacientes.',
    icon: Building2,
    results: ['Redução de 70% no tempo de agendamento', 'Aumento de 45% na satisfação dos pacientes', 'Economia de 25 horas semanais da equipe'],
    image: 'https://images.pexels.com/photos/7579831/pexels-photo-7579831.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    title: 'Plataforma de Ensino com IA',
    description: 'Criamos uma plataforma de ensino com IA que personaliza o conteúdo para cada aluno, resultando em melhor absorção de conhecimento e engajamento.',
    icon: Gauge,
    results: ['Aumento de 60% na retenção de conteúdo', 'Redução de 35% na taxa de desistência', 'Escala para milhares de alunos sem aumento de equipe'],
    image: 'https://images.pexels.com/photos/8581496/pexels-photo-8581496.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    title: 'Ecommerce com automação total',
    description: 'Implementamos um sistema de automação completo para um e-commerce, desde o atendimento até a logística, resultando em crescimento exponencial.',
    icon: ShoppingBag,
    results: ['Aumento de 120% nas vendas em 6 meses', 'Redução de 50% nos custos operacionais', 'Atendimento 24/7 sem aumento de equipe'],
    image: 'https://images.pexels.com/photos/8347499/pexels-photo-8347499.jpeg?auto=compress&cs=tinysrgb&w=600'
  }
];

const CasesSection: React.FC = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

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
    <section id="cases" className="py-20 bg-dark-900 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent"></div>
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent"></div>
      
      <div className="container relative">
        <SectionTitle
          title="Nossos Projetos Reais com Resultados Concretos"
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