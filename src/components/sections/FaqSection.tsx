import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ChevronDown } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';
import { useLanguage } from '../../context/LanguageContext';

// FAQs data will be generated from translations

const FaqItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-dark-700 last:border-b-0">
      <button
        className="flex items-center justify-between w-full py-5 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-lg font-display font-medium">{question}</h3>
        <ChevronDown 
          size={20} 
          className={`text-primary-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 opacity-100 pb-5' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-white/70">{answer}</p>
      </div>
    </div>
  );
};

const FaqSection: React.FC = () => {
  const { t } = useLanguage();
  
  const faqs = [
    {
      question: t('faq.q1.question'),
      answer: t('faq.q1.answer')
    },
    {
      question: t('faq.q2.question'),
      answer: t('faq.q2.answer')
    },
    {
      question: t('faq.q3.question'),
      answer: t('faq.q3.answer')
    },
    {
      question: t('faq.q4.question'),
      answer: t('faq.q4.answer')
    },
    {
      question: t('faq.q5.question'),
      answer: t('faq.q5.answer')
    }
  ];
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
    <section id="faq" className="py-20 relative overflow-hidden">
      {/* Background elements */}
      
      <div className="container relative">
        <SectionTitle
          title={t('faq.title')}
          subtitle={t('faq.subtitle')}
          center
          className="mb-16"
        />
        
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={variants}
          className="max-w-3xl mx-auto bg-dark-800 rounded-xl overflow-hidden"
        >
          <div className="p-6 md:p-8">
            {faqs.map((faq, index) => (
              <FaqItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FaqSection;