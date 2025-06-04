import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import SectionTitle from '../ui/SectionTitle';
import LeadForm from '../ui/LeadForm';

const ContactSection: React.FC = () => {
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
    <section id="contato" className="py-20 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950 pointer-events-none"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
      
      <div className="container relative">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={variants}
          className="max-w-3xl mx-auto"
        >
          <SectionTitle
            title="Descreva seu projeto e receba uma proposta gerada por IA"
            subtitle="Conte-nos sobre seu desafio e receba gratuitamente um diagnóstico e uma proposta personalizada gerada por nossa IA."
            center
            className="mb-8"
          />
          
          <LeadForm className="shadow-[0_0_50px_rgba(154,103,255,0.1)]" />
          
          <p className="text-center text-white/60 text-sm mt-4">
            Seus dados estão seguros. Nada de spam.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSection;