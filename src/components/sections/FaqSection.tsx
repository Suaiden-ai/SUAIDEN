import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ChevronDown } from 'lucide-react';
import SectionTitle from '../ui/SectionTitle';

const faqs = [
  {
    question: 'É IA de verdade?',
    answer: 'Sim, utilizamos tecnologias de IA avançadas como GPT-4, Claude e modelos próprios. Não é apenas marketing, são aplicações reais de inteligência artificial que geram resultados tangíveis para o seu negócio.'
  },
  {
    question: 'Preciso saber programar?',
    answer: 'Absolutamente não. Nossas soluções são desenvolvidas para serem intuitivas e fáceis de usar, independente do seu conhecimento técnico. Nossa equipe cuida de toda a parte técnica para você.'
  },
  {
    question: 'Quanto custa?',
    answer: 'Os valores variam de acordo com a complexidade e o escopo do projeto. Oferecemos planos personalizados que se adaptam às necessidades e ao orçamento da sua empresa. Entre em contato para receber uma proposta detalhada.'
  },
  {
    question: 'Qual o prazo de entrega?',
    answer: 'O prazo depende da complexidade do projeto, mas nosso processo ágil permite entregas incrementais desde as primeiras semanas. Projetos simples podem ser entregues em 2-4 semanas, enquanto projetos mais complexos podem levar de 2-3 meses.'
  },
  {
    question: 'Posso automatizar ferramentas que já uso?',
    answer: 'Sim! Uma das nossas especialidades é integrar e automatizar ferramentas existentes. Podemos conectar suas ferramentas atuais (como CRM, ERP, planilhas) e automatizar fluxos de trabalho entre elas.'
  }
];

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
          title="Perguntas Frequentes"
          subtitle="Tire suas dúvidas sobre nossos serviços e como podemos ajudar o seu negócio."
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