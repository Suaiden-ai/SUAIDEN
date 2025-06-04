import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Bot, Code, Database, Lightbulb, TerminalSquare, Zap, CheckCircle2 } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import Button from '../ui/Button';

const services = [
  {
    title: 'Automação Inteligente',
    description: 'Automatize processos repetitivos, integre sistemas e aumente a produtividade com bots personalizados para seu negócio.',
    longDescription: 'Desenvolvemos soluções de automação que eliminam tarefas manuais, reduzem erros humanos e aumentam significativamente a produtividade da sua empresa. Integramos todas suas ferramentas em um fluxo contínuo.',
    icon: Bot,
    color: 'from-primary-500/20 to-primary-700/20',
    features: [
      'Chatbots de atendimento 24/7',
      'Automação de processos (RPA)',
      'Integração entre sistemas via API',
      'Workflows personalizados',
    ],
    benefits: 'Reduza custos operacionais em até 40%',
    link: '#contato'
  },
  {
    title: 'Soluções com IA',
    description: 'Chatbots avançados, processamento de linguagem natural e geração de conteúdo com as tecnologias mais recentes de IA.',
    longDescription: 'Implementamos tecnologias de inteligência artificial que transformam dados em insights valiosos, automatizam decisões complexas e personalizam a experiência dos seus clientes a um novo nível.',
    icon: TerminalSquare,
    color: 'from-accent-500/20 to-accent-700/20',
    features: [
      'Análise preditiva de dados',
      'Geração de textos e imagens',
      'Recomendações inteligentes',
      'Reconhecimento de padrões',
    ],
    benefits: 'Aumente a eficiência operacional em até 60%',
    link: '#contato'
  },
  {
    title: 'Sistemas Sob Medida',
    description: 'Desenvolvimento de SaaS, plataformas internas e dashboards adaptados às necessidades específicas do seu negócio.',
    longDescription: 'Criamos sistemas completos e personalizados que atendem exatamente às necessidades do seu negócio, desde dashboards gerenciais a plataformas complexas de e-commerce ou gestão.',
    icon: Code,
    color: 'from-secondary-500/20 to-secondary-700/20',
    features: [
      'Aplicações web e mobile',
      'Dashboards interativos',
      'Plataformas SaaS',
      'Sistemas de gestão integrados',
    ],
    benefits: 'Tempo de desenvolvimento até 70% mais rápido',
    link: '#contato'
  },
  {
    title: 'Dados + Nuvem',
    description: 'Coleta, análise e visualização de dados com inteligência artificial para insights valiosos e tomada de decisão.',
    longDescription: 'Oferecemos soluções completas para coletar, processar e visualizar dados em tempo real, permitindo que sua empresa tome decisões baseadas em informações concretas e não em intuição.',
    icon: Database,
    color: 'from-primary-700/20 to-accent-700/20',
    features: [
      'Data lakes e warehouses',
      'Processamento em tempo real',
      'Visualização avançada de dados',
      'Big data e análise preditiva',
    ],
    benefits: 'Insights até 5x mais rápidos para decisões',
    link: '#contato'
  }
];

const ServiceCard: React.FC<{
  service: typeof services[0];
  index: number;
}> = ({ service, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = service.icon;

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
    },
    hover: {
      y: -10,
      transition: { 
        duration: 0.3, 
        ease: "easeOut"
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
      whileHover="hover"
      variants={cardVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative z-10 group"
    >
      <div className="relative h-full overflow-hidden">
        {/* Main Card */}
        <motion.div 
          className={`h-full bg-dark-900 rounded-xl p-6 flex flex-col items-center text-center
                     border border-dark-800 transition-all duration-500 ease-in-out
                     group-hover:border-primary-600/30 group-hover:shadow-[0_0_30px_rgba(154,103,255,0.15)]`}
          animate={isHovered ? { y: -5 } : { y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Card Header */}
          <motion.div 
            variants={iconMotion}
            className={`p-3 rounded-lg bg-gradient-to-br ${service.color} mb-4`}
          >
            <Icon size={24} className="text-primary-400" />
          </motion.div>
          
          <h3 className="text-xl font-display font-medium mb-2">{service.title}</h3>
          
          <div className="flex items-center justify-center mt-1 mb-3 text-sm text-white/60">
            <Zap size={14} className="mr-1 text-primary-400" />
            <span>{service.benefits}</span>
          </div>
          
          {/* Description */}
          <p className="text-white/70 mb-4">{service.description}</p>
          
          {/* Features */}
          <div className="mt-auto space-y-2 w-full">
            <ul className="space-y-2 mb-4">
              {service.features.map((feature, idx) => (
                <motion.li 
                  key={idx} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + (idx * 0.1) }}
                  className="flex items-start justify-center"
                >
                  <CheckCircle2 size={16} className="text-primary-400 mt-0.5 mr-2 flex-shrink-0" />
                  <span className="text-white/80 text-sm">{feature}</span>
                </motion.li>
              ))}
            </ul>
            
            <a 
              href={service.link} 
              className="inline-flex items-center text-sm text-primary-400 hover:text-primary-300 transition-colors group-hover:underline"
            >
              Saiba mais
              <motion.span
                animate={isHovered ? { x: 4 } : { x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowRight size={14} className="ml-1" />
              </motion.span>
            </a>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const ServicesSection: React.FC = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <section id="servicos" className="py-20 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl"></div>
      
      <div className="container relative">
        <SectionTitle
          title="Nossas Soluções Inteligentes"
          subtitle="Desenvolvemos tecnologias que transformam a maneira como as empresas operam, com foco em resultados reais e mensuráveis."
          center
          className="mb-16"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <ServiceCard key={index} service={service} index={index} />
          ))}
        </div>
        
        {/* Statistics Section */}
        <div className="mt-20 p-8 bg-dark-900/60 backdrop-blur-sm border border-dark-800 rounded-xl text-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-primary-400 text-4xl font-display font-bold">+120</div>
              <div className="text-white/70 mt-2">Projetos entregues</div>
            </div>
            <div className="text-center">
              <div className="text-primary-400 text-4xl font-display font-bold">98%</div>
              <div className="text-white/70 mt-2">Clientes satisfeitos</div>
            </div>
            <div className="text-center">
              <div className="text-primary-400 text-4xl font-display font-bold">45%</div>
              <div className="text-white/70 mt-2">Economia média</div>
            </div>
            <div className="text-center">
              <div className="text-primary-400 text-4xl font-display font-bold">24/7</div>
              <div className="text-white/70 mt-2">Suporte disponível</div>
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
              <Lightbulb size={24} className="text-primary-400" />
            </div>
          </div>
          
          <h3 className="text-2xl md:text-3xl font-display font-medium mb-4 max-w-2xl mx-auto">
            Pronto para transformar seu negócio com soluções de <span className="text-primary-400">IA realmente aplicáveis</span>?
          </h3>
          
          <p className="text-white/70 mb-8 max-w-xl mx-auto">
            Agende uma consulta gratuita com nossos especialistas e descubra como podemos criar soluções personalizadas para os desafios específicos do seu negócio.
          </p>
          
          <Button 
            size="lg"
            className="group"
            onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Solicitar consultoria gratuita
            <ArrowRight size={18} className="ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <div className="flex justify-center gap-3 mt-6">
            <div className="flex items-center">
              <CheckCircle2 size={16} className="text-primary-400 mr-1.5" />
              <span className="text-white/60 text-sm">Sem compromisso</span>
            </div>
            <div className="flex items-center">
              <CheckCircle2 size={16} className="text-primary-400 mr-1.5" />
              <span className="text-white/60 text-sm">Atendimento personalizado</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ServicesSection;