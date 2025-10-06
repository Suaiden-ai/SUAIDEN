import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import Modal from './Modal';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { generateProposal, type GeneratedProposal, type RateLimitError } from '../../services/ai';
import { insertLead } from '../../services/supabase';
import { sendNewLead } from '../../services/webhook';
import ProposalPanel from './ProposalPanel';

interface LeadFormProps {
  variant?: 'default' | 'compact';
  className?: string;
}

const LeadForm: React.FC<LeadFormProps> = ({ variant = 'default', className = '' }) => {
  const { t, language } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    projectDescription: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposal, setProposal] = useState<GeneratedProposal | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);
  const [showRateLimitNotification, setShowRateLimitNotification] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  // Dynamic placeholder typing effect
  const demoPrompts = t('hero.demoPrompts', { returnObjects: true });
  const [placeholderText, setPlaceholderText] = useState(t('hero.welcomeMessage'));
  const [promptIdx, setPromptIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const syncTextareaSize = () => {
    const el = textAreaRef.current;
    if (!el) return;
    // auto height
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    syncTextareaSize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update placeholder text when language changes
  useEffect(() => {
    if (formData.projectDescription.length === 0) {
      setPlaceholderText(t('hero.welcomeMessage'));
    }
  }, [t, formData.projectDescription.length]);

  // Typewriter effect for placeholder
  useEffect(() => {
    if (isPaused) return;
    if (formData.projectDescription.length > 0) return; // stop when user types

    const current = demoPrompts[promptIdx % demoPrompts.length];
    const typingSpeed = isDeleting ? 40 : 65;
    const pauseEnd = 1200; // pause when finished typing

    let timer: number;

    if (!isDeleting && charIdx <= current.length) {
      timer = window.setTimeout(() => {
        setPlaceholderText(current.slice(0, charIdx));
        setCharIdx(charIdx + 1);
      }, typingSpeed);
    } else if (!isDeleting && charIdx > current.length) {
      timer = window.setTimeout(() => setIsDeleting(true), pauseEnd);
    } else if (isDeleting && charIdx >= 0) {
      timer = window.setTimeout(() => {
        setPlaceholderText(current.slice(0, charIdx));
        setCharIdx(charIdx - 1);
      }, typingSpeed);
    } else if (isDeleting && charIdx < 0) {
      setIsDeleting(false);
      setPromptIdx((p) => (p + 1) % demoPrompts.length);
      setCharIdx(0);
    }

    return () => window.clearTimeout(timer);
  }, [charIdx, isDeleting, isPaused, promptIdx, formData.projectDescription]);

  // Pause typing effect and any textarea resizing while modal is open
  useEffect(() => {
    if (isModalOpen) {
      setIsPaused(true);
    } else if (formData.projectDescription.length === 0) {
      setIsPaused(false);
    }
  }, [isModalOpen, formData.projectDescription.length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleFirstStep = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Gerar proposta com IA primeiro
    if (formData.projectDescription.trim()) {
      setIsGenerating(true);
      setRateLimitError(null);
      try {
        const locale = (document.documentElement.lang || 'pt') as 'pt' | 'en';
        const result = await generateProposal(formData.projectDescription, locale);
        
        if (result && 'type' in result && result.type === 'RATE_LIMIT_EXCEEDED') {
          setRateLimitError(result);
          setProposal(null);
          setIsGenerating(false);
          setShowRateLimitNotification(true);
          // Auto-hide notification after 5 seconds
          setTimeout(() => setShowRateLimitNotification(false), 5000);
          return; // Não abrir modal se houver erro de rate limit
        } else {
          setProposal(result as GeneratedProposal | null);
        }
      } catch (error) {
        console.error('Erro ao gerar proposta:', error);
      } finally {
        setIsGenerating(false);
      }
    }
    
    // Abrir modal para capturar informações de contato
    setShowContactForm(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // In a real implementation, this would send data to your backend
    console.log('Form submitted:', formData);
    try {
      const ua = navigator.userAgent;
      
      // Captura melhorada do referrer com validação
      const referrer = document.referrer;
      const hasReferrer = referrer && referrer.length > 0;
      console.log('Referrer capturado:', { referrer, hasReferrer });
      
      // Attempt to fetch public IP (best-effort, non-blocking)
      let ip: string | null = null;
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        if (res.ok) {
          const j = await res.json();
          ip = j.ip || null;
        }
      } catch {}

      const leadId = await insertLead({
        name: formData.name,
        email: formData.email,
        whatsapp: formData.whatsapp,
        project_description: formData.projectDescription,
        ip_address: ip,
        user_agent: ua,
        referrer: hasReferrer ? referrer : null,
      });
      try { localStorage.setItem('leadId', leadId); } catch {}

      // Enviar para webhook do n8n
      try {
        await sendNewLead({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
          source: 'landing_page',
          project_description: formData.projectDescription,
        });
        console.log('Lead enviado para n8n com sucesso');
      } catch (webhookError) {
        console.error('Erro ao enviar lead para n8n:', webhookError);
        // Não bloquear o fluxo se o webhook falhar
      }
    } catch (err) {
      console.error('Failed to save lead:', err);
      // proceed anyway to avoid blocking UX
    }
    // Store locally so the studio page can use it if needed
    try {
      localStorage.setItem('leadInfo', JSON.stringify({
        name: formData.name,
        email: formData.email,
        whatsapp: formData.whatsapp,
      }));
    } catch {}

    // Redirect to studio after collecting lead info
    const desc = encodeURIComponent(formData.projectDescription);
    setIsModalOpen(false);
    window.location.hash = `/studio?desc=${desc}`;
  };

  return (
    <>
      <form 
        onSubmit={handleFirstStep} 
        className={`relative overflow-hidden backdrop-blur-sm rounded-2xl p-6 ${className}`}
      >
        {/* Full-block animated glow background */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background:
              'radial-gradient(1200px 300px at 50% 120%, rgba(154,103,255,0.16), transparent 60%), radial-gradient(600px 200px at 20% -20%, rgba(131,52,255,0.12), transparent 60%), radial-gradient(600px 200px at 80% -20%, rgba(56,189,248,0.12), transparent 60%)'
          }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="space-y-4">
          <div className="relative">
            {/* Animated full-block typing overlay when empty */}
            {formData.projectDescription.length === 0 && (
              <div className="pointer-events-none absolute left-4 right-4 top-4 md:left-5 md:right-5 md:top-5 text-white/70 text-[16px] leading-snug text-left">
                <span>{placeholderText}</span>
                <span className="ml-1 animate-pulse-slow">_</span>
              </div>
            )}
            <textarea
              ref={textAreaRef}
              id="projectDescription"
              name="projectDescription"
              rows={variant === 'compact' ? 3 : 4}
              value={formData.projectDescription}
              onChange={(e) => { handleChange(e); /* lock height during typing in modal */ if (!isModalOpen) syncTextareaSize(); }}
              onInput={() => { if (!isModalOpen) syncTextareaSize(); }}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              className={`block mx-auto w-full max-w-[480px] rounded-2xl bg-dark-900/70 border text-white p-4 md:p-5 shadow-inner resize-none placeholder-white/60 focus:outline-none focus:ring-2 transition-colors duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_0_0_0_rgba(154,103,255,0)] focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),_0_0_0_4px_rgba(154,103,255,0.15)] min-h-[64px] max-h-[max(35svh,5rem)] text-[16px] leading-snug ${
                showRateLimitNotification 
                  ? 'border-red-500/70 focus:ring-red-500/70 focus:border-red-500/50 hover:border-red-400/40' 
                  : 'border-dark-700/70 focus:ring-primary-500/70 focus:border-primary-500/50 hover:border-primary-400/40'
              }`}
              style={{ height: '64px' }}
              placeholder={formData.projectDescription.length === 0 ? '' : placeholderText}
              required
            ></textarea>
          </div>
          
          {/* Notificação de Rate Limit */}
          {showRateLimitNotification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-auto max-w-[480px] bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center"
            >
              <div className="flex items-center justify-center gap-2 text-red-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="font-medium">
                  {language === 'pt' ? 'Limite diário atingido!' : 'Daily limit reached!'}
                </span>
              </div>
              <p className="text-red-300 text-xs mt-1">
                {language === 'pt' 
                  ? 'Você já usou suas 10 requisições gratuitas. Tente novamente em 24 horas.'
                  : 'You have used all 10 free requests. Try again in 24 hours.'
                }
              </p>
            </motion.div>
          )}
          
          <Button 
            type="submit" 
            size="lg" 
            className="w-full group"
          >
            {t('contact.button')}
            <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <p className="text-white/60 text-sm text-center">
            {t('contact.privacy')}
          </p>
        </div>
      </form>

      {/* Lovable-like full screen proposal panel */}
      <ProposalPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        proposal={proposal}
        isGenerating={isGenerating}
        onRefine={async (hint) => {
          if (!formData.projectDescription) return;
          setIsGenerating(true);
          setRateLimitError(null);
          try {
            const locale = (document.documentElement.lang || 'pt') as 'pt' | 'en';
            const combined = `${formData.projectDescription}\n\nRefine: ${hint}`;
            const result = await generateProposal(combined, locale);
            
            if (result && 'type' in result && result.type === 'RATE_LIMIT_EXCEEDED') {
              setRateLimitError(result);
              setProposal(null);
            } else {
              setProposal(result as GeneratedProposal | null);
            }
          } finally {
            setIsGenerating(false);
          }
        }}
        onContinue={() => {
          setShowContactForm(true);
          setIsPanelOpen(false);
          setIsModalOpen(true);
        }}
        onCopyMarkdown={() => {
          if (!proposal) return;
          const md = `# ${proposal.title}\n\n${proposal.summary}\n\n` +
            proposal.sections.map(s => `## ${s.heading}\n\n` + s.content.map(c => `- ${c}`).join('\n')).join('\n\n') +
            `\n\n## Cronograma\n\n` + proposal.timeline.map(t => `- **${t.phase}** (${t.duration}): ${t.details}`).join('\n') +
            `\n\n_${proposal.budgetNote}_`;
          navigator.clipboard.writeText(md);
        }}
      />

      {/* Keep contact modal for the final step */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={t('contact.modal.title')}
        size="lg"
      >
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/Logo_Suaiden.png" 
              alt="Suaiden Logo" 
              className="h-12 w-auto"
            />
          </div>
          <p className="text-center text-white/80 text-sm">
            {t('contact.modal.subtitle')}
          </p>
        </div>

        {isGenerating && (
          <div className="py-8 text-center">
            <div className="mx-auto w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            <p className="mt-4 text-white/70 text-sm">Gerando proposta com IA...</p>
          </div>
        )}

        {rateLimitError && (
          <div className="py-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Limite de Requisições Excedido</h3>
            <p className="text-white/70 text-sm mb-4">{rateLimitError.message}</p>
            <div className="bg-dark-800/60 border border-dark-700 rounded-lg p-4 text-left">
              <p className="text-white/80 text-sm">
                <strong>Tentativas usadas:</strong> {rateLimitError.rateLimitInfo.attempt_count} de {rateLimitError.rateLimitInfo.max_attempts}
              </p>
              <p className="text-white/80 text-sm mt-1">
                <strong>Reset em:</strong> {new Date(rateLimitError.rateLimitInfo.reset_time).toLocaleString('pt-BR')}
              </p>
            </div>
            <Button 
              onClick={() => {
                setRateLimitError(null);
                setIsModalOpen(false);
              }}
              className="mt-4"
              variant="outline"
            >
              Entendi
            </Button>
          </div>
        )}

        {!isGenerating && proposal && !showContactForm && (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium">{proposal.title}</h4>
              <p className="text-white/80 mt-2">{proposal.summary}</p>
            </div>
            <div className="space-y-5 max-h-80 overflow-auto pr-1">
              {proposal.sections.map((s, idx) => (
                <div key={idx} className="bg-dark-800/60 border border-dark-700 rounded-lg p-4">
                  <h5 className="font-medium mb-2">{s.heading}</h5>
                  <ul className="list-disc list-inside space-y-1 text-white/80">
                    {s.content.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="bg-dark-800/60 border border-dark-700 rounded-lg p-4">
                <h5 className="font-medium mb-2">Cronograma</h5>
                <ul className="space-y-1 text-white/80">
                  {proposal.timeline.map((tItem, i) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className="text-white/60 w-40 min-w-40">{tItem.phase}</span>
                      <span className="text-white/80">{tItem.duration} — {tItem.details}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-white/70 text-sm">{proposal.budgetNote}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setShowContactForm(true)} className="flex-1 group" size="lg">
                Avançar para contato
                <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        )}

        {!isGenerating && (!proposal || showContactForm) && (
          <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-[520px] mx-auto">
            <div>
              <label htmlFor="name" className="block text-white/80 mb-1.5 text-sm">
                {t('contact.modal.name')}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-lg bg-dark-800 border border-dark-700 text-white p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent will-change-auto"
                placeholder={t('contact.modal.name')}
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-white/80 mb-1.5 text-sm">
                {t('contact.modal.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg bg-dark-800 border border-dark-700 text-white p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent will-change-auto"
                placeholder={t('contact.modal.email')}
                required
              />
            </div>
            
            <div>
              <label htmlFor="whatsapp" className="block text-white/80 mb-1.5 text-sm">
                {t('contact.modal.whatsapp')}
              </label>
              <input
                type="tel"
                id="whatsapp"
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleChange}
                className="w-full rounded-lg bg-dark-800 border border-dark-700 text-white p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent will-change-auto"
                placeholder="(00) 00000-0000"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              size="lg" 
              className="w-full mt-3 group"
            >
              {t('contact.modal.button')}
              <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
            
            <p className="text-center text-white/60 text-xs mt-2">
              {t('contact.modal.privacy')}
            </p>
          </form>
        )}
      </Modal>
    </>
  );
};

export default LeadForm;