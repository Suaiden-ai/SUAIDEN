import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Check, X } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';

const features = [
  'Soluções com IA real aplicada',
  'Automação escalável',
  'Desenvolvimento ágil',
  'Suporte 24/7',
  'Código fonte proprietário',
  'Experiência comprovada',
  'Equipe multidisciplinar',
  'Integração com sistemas existentes',
];

const ComparisonSection: React.FC = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.6,
        ease: 'easeOut'
      } 
    }
  };

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background elements */}
      
      <div className="container relative">
        <SectionTitle
          title="SUAIDEN vs alternativas"
          subtitle="Compare e entenda por que somos a escolha certa para sua empresa."
          center
          className="mb-16"
        />
        
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={variants}
          className="overflow-x-auto"
        >
          <table className="min-w-full bg-dark-800 rounded-xl overflow-hidden">
            <thead>
              <tr className="text-left border-b border-dark-700">
                <th className="p-4 md:p-6">Características</th>
                <th className="p-4 md:p-6 text-center bg-gradient-to-r from-primary-900/40 to-accent-900/40">
                  <span className="text-primary-400 font-display font-medium">SUAIDEN</span>
                </th>
                <th className="p-4 md:p-6 text-center">Freelancer</th>
                <th className="p-4 md:p-6 text-center">Agência Tradicional</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr 
                  key={index} 
                  className={`border-b border-dark-700 ${index % 2 === 0 ? 'bg-dark-800' : 'bg-dark-850'}`}
                >
                  <td className="p-4 md:p-6">{feature}</td>
                  <td className="p-4 md:p-6 text-center bg-gradient-to-r from-primary-900/40 to-accent-900/40">
                    <Check size={20} className="mx-auto text-primary-400" />
                  </td>
                  <td className="p-4 md:p-6 text-center">
                    {['Soluções com IA real aplicada', 'Desenvolvimento ágil', 'Código fonte proprietário'].includes(feature) ? (
                      <Check size={20} className="mx-auto text-white/50" />
                    ) : (
                      <X size={20} className="mx-auto text-white/30" />
                    )}
                  </td>
                  <td className="p-4 md:p-6 text-center">
                    {['Equipe multidisciplinar', 'Código fonte proprietário', 'Experiência comprovada', 'Integração com sistemas existentes'].includes(feature) ? (
                      <Check size={20} className="mx-auto text-white/50" />
                    ) : (
                      <X size={20} className="mx-auto text-white/30" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
};

export default ComparisonSection;