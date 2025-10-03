import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Check, X } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import { useLanguage } from '../../context/LanguageContext';

// Features data will be generated from translations

const ComparisonSection: React.FC = () => {
  const { t } = useLanguage();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const features = [
    t('comparison.features.realAI'),
    t('comparison.features.scalable'),
    t('comparison.features.agile'),
    t('comparison.features.support'),
    t('comparison.features.sourcecode'),
    t('comparison.features.experience'),
    t('comparison.features.team'),
    t('comparison.features.integration'),
  ];

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
          title={t('comparison.title')}
          subtitle={t('comparison.subtitle')}
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
                <th className="p-4 md:p-6">{t('comparison.features.title')}</th>
                <th className="p-4 md:p-6 text-center bg-gradient-to-r from-primary-900/40 to-accent-900/40">
                  <span className="text-primary-400 font-display font-medium">{t('comparison.options.suaiden')}</span>
                </th>
                <th className="p-4 md:p-6 text-center">{t('comparison.options.freelancer')}</th>
                <th className="p-4 md:p-6 text-center">{t('comparison.options.agency')}</th>
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