import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  center?: boolean;
  className?: string;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ 
  title, 
  subtitle, 
  center = false,
  className = '' 
}) => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const variants = {
    hidden: { opacity: 0, y: 20 },
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
    <motion.div 
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={variants}
      className={`space-y-3 ${center ? 'text-center mx-auto' : ''} ${className}`}
    >
      <h2 className="text-3xl md:text-4xl font-display font-semibold">
        {title}
      </h2>
      {subtitle && (
        <p className="text-white/70 max-w-2xl">
          {subtitle}
        </p>
      )}
      <div className={`h-1 w-16 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full ${center ? 'mx-auto' : ''}`}></div>
    </motion.div>
  );
};

export default SectionTitle;