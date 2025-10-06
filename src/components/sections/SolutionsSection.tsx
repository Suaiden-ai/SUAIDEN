import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { 
  MessageCircle, 
  Languages, 
  CreditCard, 
  Users, 
  FileCheck,
  MessageSquare,
  Mail,
  Bot,
  BookOpen
} from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import { useLanguage } from '../../context/LanguageContext';

// Reusable BentoItem component with mouse tracking
const BentoItem: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const item = itemRef.current;
    if (!item) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = item.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      item.style.setProperty('--mouse-x', `${x}px`);
      item.style.setProperty('--mouse-y', `${y}px`);
    };

    item.addEventListener('mousemove', handleMouseMove);

    return () => {
      item.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div 
      ref={itemRef} 
      className={`bento-item relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm hover:border-slate-600/50 transition-all duration-300 ${className}`}
      style={{
        background: 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139, 92, 246, 0.1) 0%, transparent 50%)'
      }}
    >
      {children}
    </div>
  );
};

const SolutionsSection: React.FC = () => {
  const { t } = useLanguage();
  const col1Controls = useAnimation();
  const col2Controls = useAnimation();
  const col3Controls = useAnimation();

  // Iniciar animações quando o componente montar
  useEffect(() => {
    col1Controls.start({
      y: ["0%", "-50%"],
      transition: {
        duration: 25,
        repeat: Infinity,
        ease: "linear",
      },
    });
    col2Controls.start({
      y: ["0%", "-50%"],
      transition: {
        duration: 30,
        repeat: Infinity,
        ease: "linear",
      },
    });
    col3Controls.start({
      y: ["0%", "-50%"],
      transition: {
        duration: 35,
        repeat: Infinity,
        ease: "linear",
      },
    });
  }, [col1Controls, col2Controls, col3Controls]);

  const iconMap = {
    chatbot: MessageCircle,
    translation: Languages,
    payment: CreditCard,
    crm: Users,
    validation: FileCheck,
    whatsapp: MessageSquare,
    email: Mail,
    agent: Bot,
    training: BookOpen,
  };

  const solutions = t('solutions.items', { returnObjects: true }) as Array<{
    title: string;
    description: string;
    icon: keyof typeof iconMap;
  }>;

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container relative">
        <SectionTitle
          title={t('solutions.title')}
          subtitle={t('solutions.subtitle')}
          center
          className="mb-20"
        />
        
        {/* Mobile: Uma coluna com todos os cards */}
        <div className="block md:hidden">
          <div 
            className="overflow-hidden h-[36rem]"
            onMouseEnter={() => {
              col1Controls.stop();
            }}
            onMouseLeave={() => {
              col1Controls.start({
                y: ["0%", "-50%"],
                transition: {
                  duration: 25,
                  repeat: Infinity,
                  ease: "linear",
                },
              });
            }}
          >
            <motion.div
              animate={col1Controls}
              className="flex flex-col gap-3 pb-3"
            >
              {[
                ...new Array(2).fill(0).map((_, index) => (
                  <React.Fragment key={index}>
                    {solutions.map((solution, i) => {
                      const Icon = iconMap[solution.icon];
                      
                      return (
                        <BentoItem 
                          key={i} 
                          className="p-6 rounded-2xl shadow-lg shadow-primary/10 w-full"
                        >
                          <div className="flex flex-col h-full">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center flex-shrink-0">
                                <Icon size={18} className="text-primary-400" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-1 leading-tight">{solution.title}</h3>
                              </div>
                            </div>
                            
                            <div className="text-slate-300 text-sm leading-relaxed mb-4 flex-grow">
                              {solution.description}
                            </div>
                            
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
                          </div>
                        </BentoItem>
                      );
                    })}
                  </React.Fragment>
                )),
              ]}
            </motion.div>
          </div>
        </div>

        {/* Desktop: Três colunas */}
        <div 
          className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20"
          onMouseEnter={() => {
            col1Controls.stop();
            col2Controls.stop();
            col3Controls.stop();
          }}
          onMouseLeave={() => {
            col1Controls.start({
              y: ["0%", "-50%"],
              transition: {
                duration: 25,
                repeat: Infinity,
                ease: "linear",
              },
            });
            col2Controls.start({
              y: ["0%", "-50%"],
              transition: {
                duration: 30,
                repeat: Infinity,
                ease: "linear",
              },
            });
            col3Controls.start({
              y: ["0%", "-50%"],
              transition: {
                duration: 35,
                repeat: Infinity,
                ease: "linear",
              },
            });
          }}
        >
          {/* Coluna 1 */}
          <div className="overflow-hidden h-[36rem]">
            <motion.div
              animate={col1Controls}
              className="flex flex-col gap-7 pb-7"
            >
              {[
                ...new Array(2).fill(0).map((_, index) => (
                  <React.Fragment key={index}>
                    {solutions.slice(0, 3).map((solution, i) => {
                      const Icon = iconMap[solution.icon];
                      
                      return (
                        <BentoItem 
                          key={i} 
                          className="p-6 rounded-2xl shadow-lg shadow-primary/10 w-full"
                        >
                          <div className="flex flex-col h-full">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center flex-shrink-0">
                                <Icon size={18} className="text-primary-400" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-1 leading-tight">{solution.title}</h3>
                              </div>
                            </div>
                            
                            <div className="text-slate-300 text-sm leading-relaxed mb-4 flex-grow">
                              {solution.description}
                            </div>
                            
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
                          </div>
                        </BentoItem>
                      );
                    })}
                  </React.Fragment>
                )),
              ]}
            </motion.div>
          </div>

          {/* Coluna 2 */}
          <div className="overflow-hidden h-[36rem]">
            <motion.div
              animate={col2Controls}
              className="flex flex-col gap-7 pb-7"
            >
              {[
                ...new Array(2).fill(0).map((_, index) => (
                  <React.Fragment key={index}>
                    {solutions.slice(3, 6).map((solution, i) => {
                      const Icon = iconMap[solution.icon];
                      
                      return (
                        <BentoItem 
                          key={i} 
                          className="p-6 rounded-2xl shadow-lg shadow-primary/10 w-full"
                        >
                          <div className="flex flex-col h-full">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center flex-shrink-0">
                                <Icon size={18} className="text-primary-400" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-1 leading-tight">{solution.title}</h3>
                              </div>
                            </div>
                            
                            <div className="text-slate-300 text-sm leading-relaxed mb-4 flex-grow">
                              {solution.description}
                            </div>
                            
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
                          </div>
                        </BentoItem>
                      );
                    })}
                  </React.Fragment>
                )),
              ]}
            </motion.div>
          </div>

          {/* Coluna 3 */}
          <div className="overflow-hidden h-[36rem]">
            <motion.div
              animate={col3Controls}
              className="flex flex-col gap-7 pb-7"
            >
              {[
                ...new Array(2).fill(0).map((_, index) => (
                  <React.Fragment key={index}>
                    {solutions.slice(6).map((solution, i) => {
                      const Icon = iconMap[solution.icon];
                      
                      return (
                        <BentoItem 
                          key={i} 
                          className="p-6 rounded-2xl shadow-lg shadow-primary/10 w-full"
                        >
                          <div className="flex flex-col h-full">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center flex-shrink-0">
                                <Icon size={18} className="text-primary-400" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-1 leading-tight">{solution.title}</h3>
                              </div>
                            </div>
                            
                            <div className="text-slate-300 text-sm leading-relaxed mb-4 flex-grow">
                              {solution.description}
                            </div>
                            
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
                          </div>
                        </BentoItem>
                      );
                    })}
                  </React.Fragment>
                )),
              ]}
            </motion.div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default SolutionsSection;
