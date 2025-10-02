git import React from 'react';
import SectionTitle from '../ui/SectionTitle';
import { useLanguage } from '../../context/LanguageContext';

const technologies = [
  { name: 'OpenAI', logo: '/Logos/openai.svg', needsWhiteFilter: true },
  { name: 'LangChain', logo: '/Logos/langchain-text.svg', needsWhiteFilter: true },
  { name: 'Anthropic', logo: '/Logos/anthropic.svg', needsWhiteFilter: true },
  { name: 'React', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg' },
  { name: 'Next.js', logo: '/Logos/Next.js.svg', needsWhiteFilter: true },
  { name: 'Node.js', logo: '/Logos/icons8-nodejs.svg', needsWhiteFilter: true },
  { name: 'Python', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg' },
  { name: 'Supabase', logo: '/Logos/icons8-supabase.svg' },
  { name: 'PostgreSQL', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg' },
  { name: 'Firebase', logo: 'https://firebase.google.com/static/downloads/brand-guidelines/PNG/logo-logomark.png' },
  { name: 'Stripe', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg' },
  { name: 'TailwindCSS', logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Tailwind_CSS_Logo.svg' },
  { name: 'AWS', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg' },
  { name: 'TypeScript', logo: '/Logos/TypeScript.svg' },
  { name: 'Vue.js', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Vue.js_Logo_2.svg' },
  { name: 'Docker', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Docker_%28container_engine%29_logo.svg' },
  { name: 'MongoDB', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/93/MongoDB_Logo.svg' },
  { name: 'Redis', logo: '/Logos/icons8-redis.svg' },
  { name: 'GraphQL', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/17/GraphQL_Logo.svg' },
  { name: 'GitHub', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg' },
];

const TechnologiesSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16 relative overflow-hidden">
      <div className="container relative z-10">
        <SectionTitle 
          title={t('technologies.title')}
          center
          className="mb-12"
        />
      </div>
      
      {/* Full width carousel */}
      <div className="relative overflow-hidden w-full">
        <div 
          className="flex space-x-16 items-center py-6"
          style={{
            animation: `scroll ${40}s linear infinite`,
            width: 'max-content'
          }}
        >
          {/* Duplicate the technologies array for seamless loop */}
          {[...technologies, ...technologies].map((tech, index) => (
            <div
              key={`tech-${index}`}
              className="flex flex-col items-center w-[140px] flex-shrink-0"
            >
              <div className="h-16 flex items-center justify-center mb-3">
                <img 
                  src={tech.logo} 
                  alt={tech.name} 
                  className={`h-12 md:h-14 object-contain transition-opacity ${
                    tech.needsWhiteFilter 
                      ? 'filter brightness-0 invert opacity-80 hover:opacity-100' 
                      : 'opacity-80 hover:opacity-100'
                  }`}
                />
              </div>
              <span className="text-white/60 text-sm font-medium text-center">{tech.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechnologiesSection;