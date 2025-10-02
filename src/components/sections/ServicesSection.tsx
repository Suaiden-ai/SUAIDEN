import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { solidIcons } from '../../lib/icons';
import SectionTitle from '../ui/SectionTitle';
import Button from '../ui/Button';
import SchedulingModal from '../ui/SchedulingModal';

const services = [
  {
    title: 'AUTOMAÇÃO INTELIGENTE',
    description: 'Automatize processos repetitivos, integre sistemas e aumente a produtividade com bots personalizados para seu negócio.',
    longDescription: 'Desenvolvemos soluções de automação que eliminam tarefas manuais, reduzem erros humanos e aumentam significativamente a produtividade da sua empresa. Integramos todas suas ferramentas em um fluxo contínuo.',
    icon: solidIcons.faRobot,
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
    title: 'SOLUÇÕES COM IA',
    description: 'Chatbots avançados, processamento de linguagem natural e geração de conteúdo com as tecnologias mais recentes de IA.',
    longDescription: 'Implementamos tecnologias de inteligência artificial que transformam dados em insights valiosos, automatizam decisões complexas e personalizam a experiência dos seus clientes a um novo nível.',
    icon: solidIcons.faTerminal,
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
    title: 'SISTEMAS SOB MEDIDA',
    description: 'Desenvolvimento de SaaS, plataformas internas e dashboards adaptados às necessidades específicas do seu negócio.',
    longDescription: 'Criamos sistemas completos e personalizados que atendem exatamente às necessidades do seu negócio, desde dashboards gerenciais a plataformas complexas de e-commerce ou gestão.',
    icon: solidIcons.faCode,
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
    title: 'DADOS + NUVEM',
    description: 'Coleta, análise e visualização de dados com inteligência artificial para insights valiosos e tomada de decisão.',
    longDescription: 'Oferecemos soluções completas para coletar, processar e visualizar dados em tempo real, permitindo que sua empresa tome decisões baseadas em informações concretas e não em intuição.',
    icon: solidIcons.faDatabase,
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
                {service.features.map((feature, idx) => (
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
              
              {/* Button - Centered */}
              <div className="flex justify-center">
                <a 
                  href={service.link} 
                  className="inline-flex items-center text-sm text-white hover:text-primary-100 transition-all duration-300
                             bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500
                             px-5 py-2.5 rounded-lg border border-primary-400/30 hover:border-primary-300/50
                             shadow-lg shadow-primary-500/25 hover:shadow-primary-400/40
                             font-semibold group-hover:scale-105"
                >
                  Saiba mais
                  <motion.span
                    animate={isHovered ? { x: 4 } : { x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FontAwesomeIcon icon={solidIcons.faArrowRight} size="sm" className="ml-2" />
                  </motion.span>
                </a>
              </div>
            </div>
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
          title="NOSSAS SOLUÇÕES INTELIGENTES"
          subtitle="Desenvolvemos tecnologias que transformam a maneira como as empresas operam, com foco em resultados reais e mensuráveis."
          center
          className="mb-16"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-8xl mx-auto">
          {services.map((service, index) => (
            <ServiceCard key={index} service={service} index={index} />
          ))}
        </div>
        
        {/* Statistics Section */}
        <div className="mt-20 p-8 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl text-center shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-primary-300 text-4xl font-display font-bold">+120</div>
              <div className="text-slate-300 mt-2 font-medium">Projetos entregues</div>
            </div>
            <div className="text-center">
              <div className="text-primary-300 text-4xl font-display font-bold">98%</div>
              <div className="text-slate-300 mt-2 font-medium">Clientes satisfeitos</div>
            </div>
            <div className="text-center">
              <div className="text-primary-300 text-4xl font-display font-bold">45%</div>
              <div className="text-slate-300 mt-2 font-medium">Economia média</div>
            </div>
            <div className="text-center">
              <div className="text-primary-300 text-4xl font-display font-bold">24/7</div>
              <div className="text-slate-300 mt-2 font-medium">Suporte disponível</div>
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
            Pronto para transformar seu negócio com soluções de <span className="text-primary-400">IA realmente aplicáveis</span>?
          </h3>
          
          <p className="text-white/70 mb-8 max-w-xl mx-auto">
            Agende uma consulta gratuita com nossos especialistas e descubra como podemos criar soluções personalizadas para os desafios específicos do seu negócio.
          </p>
          
          <Button 
            size="lg"
            className="group"
            onClick={() => setIsSchedulingModalOpen(true)}
          >
            Solicitar consultoria gratuita
            <FontAwesomeIcon icon={solidIcons.faArrowRight} size="sm" className="ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <div className="flex justify-center gap-3 mt-6">
            <div className="flex items-center">
              <FontAwesomeIcon icon={solidIcons.faCheckCircle} size="sm" className="text-primary-400 mr-1.5" />
              <span className="text-white/60 text-sm">Sem compromisso</span>
            </div>
            <div className="flex items-center">
              <FontAwesomeIcon icon={solidIcons.faCheckCircle} size="sm" className="text-primary-400 mr-1.5" />
              <span className="text-white/60 text-sm">Atendimento personalizado</span>
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
