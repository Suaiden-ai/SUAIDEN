import React, { useEffect, useRef } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import SectionTitle from '../ui/SectionTitle';
import { useLanguage } from '../../context/LanguageContext';

const technologies = [
  { name: 'OpenAI', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg' },
  { name: 'LangChain', logo: 'https://avatars.githubusercontent.com/u/126733545?s=200&v=4' },
  { name: 'React', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg' },
  { name: 'Next.js', logo: 'https://seeklogo.com/images/N/next-js-logo-8FCFF51DD2-seeklogo.com.png' },
  { name: 'Node.js', logo: 'https://nodejs.org/static/images/logos/nodejs-new-pantone-white.svg' },
  { name: 'Python', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg' },
  { name: 'Supabase', logo: 'https://seeklogo.com/images/S/supabase-logo-DCC676FFE2-seeklogo.com.png' },
  { name: 'PostgreSQL', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg' },
  { name: 'Firebase', logo: 'https://firebase.google.com/static/downloads/brand-guidelines/PNG/logo-logomark.png' },
  { name: 'Stripe', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg' },
  { name: 'TailwindCSS', logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Tailwind_CSS_Logo.svg' },
  { name: 'AWS', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg' },
  // Duplicating to ensure continuous scrolling effect
  { name: 'OpenAI', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg' },
  { name: 'LangChain', logo: 'https://avatars.githubusercontent.com/u/126733545?s=200&v=4' },
  { name: 'React', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg' },
  { name: 'Next.js', logo: 'https://seeklogo.com/images/N/next-js-logo-8FCFF51DD2-seeklogo.com.png' },
  { name: 'Node.js', logo: 'https://nodejs.org/static/images/logos/nodejs-new-pantone-white.svg' },
  { name: 'Python', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg' },
];

const TechnologiesSection: React.FC = () => {
  const { t } = useLanguage();
  const carouselRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const inViewRef = useRef(null);
  const inView = useInView(inViewRef, { once: false });

  // Start animation when section is in view
  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  return (
    <section className="py-16 relative overflow-hidden">
      
      <div className="container relative z-10">
        <div ref={inViewRef}>
          <SectionTitle 
            title={t('technologies.title')}
            center
            className="mb-12"
          />
        </div>
        
        {/* Single row carousel */}
        <div className="relative overflow-hidden mx-auto px-4 py-6">
          <div className="mb-10" ref={carouselRef}>
            <motion.div
              className="flex space-x-12"
              animate={{
                x: [0, -2400],
              }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 40,
                  ease: "linear"
                }
              }}
            >
              {technologies.map((tech, index) => (
                <div
                  key={`tech-${index}`}
                  className="flex flex-col items-center min-w-[120px]"
                >
                  <div className="h-14 flex items-center justify-center mb-2">
                    <img 
                      src={tech.logo} 
                      alt={tech.name} 
                      className="tech-icon h-10 md:h-12 object-contain" 
                    />
                  </div>
                  <span className="text-white/60 text-sm">{tech.name}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechnologiesSection;