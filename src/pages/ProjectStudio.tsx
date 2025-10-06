import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { upsertStudioState } from '../services/supabase';
import { type GeneratedProposal } from '../services/ai';
import Button from '../components/ui/Button';
import ChatInput from '../components/ui/ChatInput';
import SchedulingModal from '../components/ui/SchedulingModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { solidIcons } from '../lib/icons';
import FlowCanvas, { type NodeData, type FlowCanvasHandle } from '../components/ui/FlowCanvas';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../context/LanguageContext';

// Safe UUID generator: tries crypto.randomUUID, then getRandomValues, then Math.random
function generateSafeUUID(): string {
  const globalCrypto = (globalThis as any)?.crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalCrypto.getRandomValues(bytes);
    // Per RFC 4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
    return (
      hex.slice(0, 4).join('') +
      hex.slice(4, 6).join('') +
      '-' +
      hex.slice(6, 8).join('') +
      '-' +
      hex.slice(8, 10).join('') +
      '-' +
      hex.slice(10, 12).join('') +
      '-' +
      hex.slice(12, 16).join('')
    );
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


// Calcula a faixa total de duração a partir do cronograma (min–max) respeitando unidades e idiomas
function computeTimelineDurationRange(timeline: { duration: string }[], locale: 'pt' | 'en') {
  if (!timeline || timeline.length === 0) return null;
  // Se qualquer item for contínuo/ongoing, priorizar essa informação
  const hasOngoing = timeline.some((p) => /ongoing|contínuo|continuo/i.test(p.duration));
  if (hasOngoing) {
    return locale === 'pt' ? 'Contínuo' : 'Ongoing';
  }

  // Conversões para dias
  const toDays = (value: number, unit: 'day' | 'week' | 'month') => {
    if (unit === 'day') return value;
    if (unit === 'week') return value * 7;
    return value * 30; // month approx
  };

  let totalMinDays = 0;
  let totalMaxDays = 0;

  const norm = (s: string) => s.replace(/[–—]/g, '-').toLowerCase();
  const detectUnit = (s: string): 'day' | 'week' | 'month' | null => {
    if (/(day|days|dia|dias)/i.test(s)) return 'day';
    if (/(week|weeks|semana|semanas)/i.test(s)) return 'week';
    if (/(month|months|mês|meses)/i.test(s)) return 'month';
    return null;
  };

  timeline.forEach((phase) => {
    const d = norm(phase.duration);
    const unit = detectUnit(d) || 'week'; // default to weeks if unspecified
    const matchRange = d.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    const matchSingle = d.match(/(\d+(?:\.\d+)?)/);
    let minVal = 0;
    let maxVal = 0;
    if (matchRange) {
      minVal = parseFloat(matchRange[1]);
      maxVal = parseFloat(matchRange[2]);
    } else if (matchSingle) {
      minVal = maxVal = parseFloat(matchSingle[1]);
        } else {
      // sem números claros; ignorar fase na soma
      minVal = 0;
      maxVal = 0;
    }
    totalMinDays += toDays(minVal, unit);
    totalMaxDays += toDays(maxVal, unit);
  });

  // Escolher a unidade de saída mais legível
  const formatRange = (minDays: number, maxDays: number) => {
    const preferWeeks = maxDays >= 14 && maxDays < 120; // entre 2 semanas e ~4 meses
    const preferMonths = maxDays >= 120; // ~4+ meses
    if (preferMonths) {
      const minM = Math.round(minDays / 30);
      const maxM = Math.round(maxDays / 30);
      if (locale === 'pt') return minM === maxM ? `${maxM} mês${maxM === 1 ? '' : 'es'}` : `${minM}–${maxM} meses`;
      return minM === maxM ? `${maxM} month${maxM === 1 ? '' : 's'}` : `${minM}–${maxM} months`;
    }
    if (preferWeeks) {
      const minW = Math.round(minDays / 7);
      const maxW = Math.round(maxDays / 7);
      if (locale === 'pt') return minW === maxW ? `${maxW} semana${maxW === 1 ? '' : 's'}` : `${minW}–${maxW} semanas`;
      return minW === maxW ? `${maxW} week${maxW === 1 ? '' : 's'}` : `${minW}–${maxW} weeks`;
    }
    // dias
    const minD = Math.round(totalMinDays);
    const maxD = Math.round(totalMaxDays);
    if (locale === 'pt') return minD === maxD ? `${maxD} dia${maxD === 1 ? '' : 's'}` : `${minD}–${maxD} dias`;
    return minD === maxD ? `${maxD} day${maxD === 1 ? '' : 's'}` : `${minD}–${maxD} days`;
  };

  return formatRange(totalMinDays, totalMaxDays);
}

// ANOTAÇÃO: Componente para o indicador "Thinking..." para limpar o JSX principal.
const ThinkingIndicator: React.FC<{ t: (key: string) => string }> = ({ t }) => (
  <div className="flex items-center gap-2 text-gray-400">
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
    <span className="text-sm">{t('studio.thinking')}</span>
  </div>
);

// Formatter simples e elegante para o chat
const AssistantMessage: React.FC<{ content: string; isStreaming?: boolean }> = ({ content }) => {
  const lines = content.split('\n');

  const isEmpty = (s: string) => !s.trim();
  const isNumberOnly = (s: string) => /^\s*\d+\s*$/.test(s);
  const isBullet = (s: string) => /^(\s*[•\-*]\s+|\s*\d+\.\s+)/.test(s);
  const isHeading = (s: string) => /:\s*$/.test(s.trim()) || (/^[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ][\wÁÂÃÀÉÊÍÓÔÕÚÇ\s/&()\-]{2,}$/.test(s.trim()) && s.trim().length <= 80);
  const durationCard = (s: string) => s.match(/^\s*((?:Ongoing|Contínuo|Continuo)|\d+(?:\s*[-–—]\s*\d+)?\s*(?:weeks?|days?|months?|semanas?|dias?|meses?))\s*:\s*(.+)$/i);
  const fullTriplet = (s: string) => {
    if (!s.includes('—')) return null;
    const parts = s.split('—');
    if (parts.length < 3) return null;
    const [title, duration, ...rest] = parts;
    if (!/(weeks?|days?|months?|semanas?|dias?|meses?|Ongoing|Contínuo|Continuo)/i.test(duration)) return null;
    return { title: title.trim(), duration: duration.trim(), details: rest.join('—').trim() };
  };
  const titleDashDurationColon = (s: string) => s.match(/^\s*(.+?)\s*—\s*((?:Ongoing|Contínuo|Continuo)|\d+(?:\s*[-–—]\s*\d+)?\s*(?:weeks?|days?|months?|semanas?|dias?|meses?))\s*:\s*(.+)$/i);

  // Para streaming, formatamos incrementalmente, mas mantendo a mesma estrutura visual.
  // Estratégia: usamos as mesmas regras, mas devolvemos placeholders para blocos incompletos
  return (
    <div className="space-y-3">
      {lines.map((raw, idx) => {
        const line = raw.replace(/[–—]/g, '—');
        if (isEmpty(line) || isNumberOnly(line)) return null;

        // Card do tipo: Fase — Duração — Detalhes
        const trip = fullTriplet(line);
        if (trip) {
          return (
            <div key={idx} className="rounded-xl p-3 sm:p-4 bg-gradient-to-b from-slate-800/70 to-slate-800/30 border border-slate-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-block w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_0_3px_rgba(139,92,246,0.2)]" />
                <div className="flex-1">
                  <div className="text-[13px] sm:text-sm text-violet-300 font-semibold mb-1 break-words whitespace-pre-wrap">{trip.title}</div>
                  <div className="text-[11px] sm:text-xs text-white font-semibold mb-1 tracking-wide uppercase">{trip.duration}</div>
                  {trip.details && <div className="text-gray-200 text-[13px] sm:text-sm leading-6 break-words whitespace-pre-wrap">{trip.details}</div>}
                </div>
              </div>
            </div>
          );
        }

        // Card do tipo: Fase — Duração: Detalhes
        const td = titleDashDurationColon(line);
        if (td) {
          return (
            <div key={idx} className="rounded-xl p-3 sm:p-4 bg-gradient-to-b from-slate-800/70 to-slate-800/30 border border-slate-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-block w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_0_3px_rgba(139,92,246,0.2)]" />
                <div className="flex-1">
                  <div className="text-[13px] sm:text-sm text-violet-300 font-semibold mb-1 break-words whitespace-pre-wrap">{td[1].trim()}</div>
                  <div className="text-[11px] sm:text-xs text-white font-semibold mb-1 tracking-wide uppercase">{td[2].trim()}</div>
                  <div className="text-gray-200 text-[13px] sm:text-sm leading-6 break-words whitespace-pre-wrap">{td[3].trim()}</div>
                </div>
              </div>
            </div>
          );
        }

        const dur = durationCard(line);
        if (dur) {
          return (
            <div key={idx} className="rounded-xl p-3 sm:p-4 bg-gradient-to-b from-slate-800/70 to-slate-800/30 border border-slate-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-block w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_0_3px_rgba(139,92,246,0.2)]" />
                <div className="flex-1">
                  <div className="text-[11px] sm:text-xs text-white font-semibold mb-1 break-words whitespace-pre-wrap tracking-wide uppercase">{dur[1].trim()}</div>
                  <div className="text-gray-200 text-[13px] sm:text-sm leading-6 break-words whitespace-pre-wrap">{dur[2].trim()}</div>
                </div>
              </div>
            </div>
          );
        }

        if (isHeading(line)) {
          const label = line.replace(/:\s*$/, '').trim();
          const isProjectSummary = /^(Project Summary|Resumo do Projeto)$/i.test(label);
          const isSuggestedSchedule = /^(Suggested Schedule|Cronograma sugerido)$/i.test(label);
          return (
            <div key={idx} className="pt-2">
              <div className={`${(isProjectSummary || isSuggestedSchedule) ? 'text-white' : 'text-violet-300'} font-semibold text-sm sm:text-[15px] tracking-wide break-words whitespace-pre-wrap`}>
                {label}
              </div>
              <div className="h-px mt-1 bg-gradient-to-r from-violet-500/40 via-violet-500/10 to-transparent" />
            </div>
          );
        }

        if (isBullet(line)) {
          const text = line.replace(/^\s*[•\-*]\s+/, '').replace(/^\s*\d+\.\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-3 text-gray-200 leading-relaxed">
              <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span className="break-words whitespace-pre-wrap text-[13px] sm:text-sm">{text}</span>
            </div>
          );
        }

        if (line.includes('**') && line.split('**').length >= 3) {
          const parts = line.split('**');
          return (
            <div key={idx} className="text-gray-200 leading-relaxed">
              {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{p}</strong> : <span key={i}>{p}</span>))}
            </div>
          );
        }

        return (
          <div key={idx} className="text-gray-200 leading-7 tracking-[0.01em] text-[13px] sm:text-sm break-words whitespace-pre-wrap">{line}</div>
        );
      })}
    </div>
  );
};


function useHashQuery(): URLSearchParams {
  const [params, setParams] = useState(() => new URLSearchParams(location.hash.split('?')[1] || ''));
  useEffect(() => {
    const onHash = () => setParams(new URLSearchParams(location.hash.split('?')[1] || ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return params;
}

const ProjectStudio: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  
  // Sync language with localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as 'pt' | 'en';
    if (savedLanguage && savedLanguage !== language) {
      console.log('🔄 Syncing language from localStorage:', savedLanguage);
      setLanguage(savedLanguage);
    }
  }, [language, setLanguage]);
  
  const params = useHashQuery();
  const flowRef = useRef<FlowCanvasHandle>(null);
  const initialDesc = useMemo(() => params.get('desc') ? decodeURIComponent(params.get('desc') as string) : '', [params]);
  const sessionId = useRef<string>('');
  
  if (!sessionId.current) {
    const existing = sessionStorage.getItem('studioSessionId');
    if (existing) {
      sessionId.current = existing;
    } else {
      const id = generateSafeUUID();
      sessionStorage.setItem('studioSessionId', id);
      sessionId.current = id;
    }
  }

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; isStreaming?: boolean }[]>(
    () => (initialDesc ? [{ role: 'user', content: initialDesc }] : [])
  );
  const [input, setInput] = useState('');
  const [proposal, setProposal] = useState<GeneratedProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const didInitRef = useRef(false);
  const [mobileView, setMobileView] = useState<'chat' | 'flow'>('chat');
  const [isChatHidden, setIsChatHidden] = useState(false);
  const [edgeHintPulse, setEdgeHintPulse] = useState(true);
  const [aiFeedback, setAiFeedback] = useState<Record<number, 'up' | 'down' | undefined>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [isGeneratingFlow, setIsGeneratingFlow] = useState(false);
  const [showFlowTip, setShowFlowTip] = useState(() => {
    try { return localStorage.getItem('studio_flow_tip_dismissed') !== '1'; } catch { return true; }
  });
  const [showFlowNavTip, setShowFlowNavTip] = useState(() => {
    try { return localStorage.getItem('studio_flow_nav_tip_dismissed') !== '1'; } catch { return true; }
  });
  const [flowNavTipStep, setFlowNavTipStep] = useState(0);
  const flowCanvasContainerRef = useRef<HTMLDivElement>(null);
  const [flowDesktopTipPos, setFlowDesktopTipPos] = useState<{ x: number; y: number } | null>(null);
  
  const [showConsultTip, setShowConsultTip] = useState(() => {
    try { return localStorage.getItem('studio_consult_tip_dismissed') !== '1'; } catch { return true; }
  });

  const scrollToBottom = useCallback(() => {
    try { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); } catch {}
  }, []);

  // Constrói a descrição completa usando o histórico do chat e o estado atual
  const buildDescriptionFromHistory = useCallback((newUserText?: string) => {
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
    const refinements = [...userMessages.slice(initialDesc ? 1 : 0), ...(newUserText ? [newUserText] : [])]
      .filter(Boolean);

    let description = initialDesc || userMessages[0] || '';
    if (refinements.length) {
      description += '\n\nRefinamentos solicitados pelo usuário:' +
        '\n- ' + refinements.join('\n- ');
    }

    if (proposal) {
      const timelineText = proposal.timeline?.map(t => `${t.phase} — ${t.duration}: ${t.details}`).join('\n- ');
      if (timelineText) {
        description += `\n\nContexto do cronograma atual (para manter continuidade):\n- ${timelineText}`;
      }
      if (proposal.summary) {
        description += `\n\nResumo atual do projeto:\n${proposal.summary}`;
      }
    }

    return description.trim();
  }, [messages, initialDesc, proposal]);

  useEffect(() => {
    const t = setTimeout(() => setEdgeHintPulse(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ANOTAÇÃO: useEffect para detectar quando uma proposta está sendo gerada
  useEffect(() => {
    if (proposal) {
      setHasGenerated(true);
      setEdgeHintPulse(false);
      // Loading termina quando a proposta está pronta
      setIsGeneratingFlow(false);
    }
  }, [proposal]);

  // ANOTAÇÃO: useEffect para detectar quando está gerando (quando não há proposta ainda)
  useEffect(() => {
    if (!proposal && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Se a última mensagem é do usuário, está aguardando resposta da IA
      if (lastMessage.role === 'user') {
        setIsGeneratingFlow(true);
      }
    }
  }, [proposal, messages]);

  // Mostrar mini tutoriais ao terminar resposta (mobile e desktop)
  useEffect(() => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    if (proposal && last.role === 'assistant' && !last.isStreaming) {
      try {
        const flowDismissed = localStorage.getItem('studio_flow_tip_dismissed') === '1';
        const consultDismissed = localStorage.getItem('studio_consult_tip_dismissed') === '1';
        if (isMobile) {
          // Mobile: Visualizar fluxo -> Consultoria
          if (!flowDismissed) { setShowFlowTip(true); setShowConsultTip(false); }
          else if (!consultDismissed) { setShowConsultTip(true); scrollToBottom(); }
        } else {
          // Desktop: não há botão Visualizar fluxo; priorize Consultoria
          if (!consultDismissed) { setShowConsultTip(true); }
        }
      } catch {
        if (isMobile) {
          if (showFlowTip) { setShowFlowTip(true); setShowConsultTip(false); }
          else if (showConsultTip) { setShowConsultTip(true); scrollToBottom(); }
        } else {
          if (showConsultTip) { setShowConsultTip(true); }
        }
      }
      if (showFlowNavTip) setShowFlowNavTip(true);
    }
  }, [messages, proposal, showFlowTip, showFlowNavTip, showConsultTip, scrollToBottom]);

  const dismissFlowTip = useCallback(() => {
    setShowFlowTip(false);
    try { localStorage.setItem('studio_flow_tip_dismissed', '1'); } catch {}
  }, []);

  const dismissFlowNavTip = useCallback(() => {
    setShowFlowNavTip(false);
    try { localStorage.setItem('studio_flow_nav_tip_dismissed', '1'); } catch {}
  }, []);

  const flowTips = useMemo(() => ([
    {
      title: t('studio.tips.flow.navigate.title'),
      text: t('studio.tips.flow.navigate.text'),
      anchorSelector: '#flow-help-button'
    },
    {
      title: t('studio.tips.flow.consult.title'),
      text: t('studio.tips.flow.consult.text'),
      anchorSelector: '#btn-flow-consult',
      offsetX: -12
    },
    {
      title: t('studio.tips.flow.export.title'),
      text: t('studio.tips.flow.export.text'),
      anchorSelector: '#btn-save-pdf',
      offsetX: 20
    }
  ]), [t]);

  const computeAnchorPos = useCallback((selector: string, opts?: { offsetX?: number; offsetY?: number }) => {
    if (!flowCanvasContainerRef.current) return null;
    const container = flowCanvasContainerRef.current;
    const anchor = document.querySelector(selector) as HTMLElement | null;
    if (!anchor) return null;
    const contRect = container.getBoundingClientRect();
    const aRect = anchor.getBoundingClientRect();
    const tipWidth = Math.min(420, Math.min(contRect.width * 0.6, 512));
    const containerPadding = 12;
    const gap = 16; // distância entre dica e botão
    const estimatedTipHeight = 140; // aproximação suficiente p/ posicionar

    // Alinhar preferencialmente pela direita do alvo, com leve recuo
    let x = aRect.right - contRect.left - tipWidth + 8 + (opts?.offsetX ?? 0);
    // Clamps horizontais
    x = Math.max(containerPadding, Math.min(x, contRect.width - tipWidth - containerPadding));

    // Tentar acima primeiro com gap generoso; se não couber, posicionar abaixo com gap
    let yAbove = aRect.top - contRect.top - (estimatedTipHeight + gap);
    let y: number;
    if (yAbove >= containerPadding) {
      y = yAbove + (opts?.offsetY ?? 0);
    } else {
      y = aRect.bottom - contRect.top + gap + (opts?.offsetY ?? 0);
    }

    // Clamp vertical dentro do container
    y = Math.max(containerPadding, Math.min(y, contRect.height - containerPadding - 80));
    return { x, y };
  }, []);

  const openFlowNavTip = useCallback(() => {
    setShowFlowNavTip(true);
    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      const cfg = flowTips[flowNavTipStep] as any;
      const pos = computeAnchorPos(cfg.anchorSelector, { offsetX: cfg.offsetX, offsetY: cfg.offsetY });
      if (pos) setFlowDesktopTipPos(pos);
    }
  }, [computeAnchorPos, flowNavTipStep, flowTips]);

  useEffect(() => {
    if (!showFlowNavTip) return;
    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      const cfg = flowTips[flowNavTipStep] as any;
      const pos = computeAnchorPos(cfg.anchorSelector, { offsetX: cfg.offsetX, offsetY: cfg.offsetY });
      if (pos) setFlowDesktopTipPos(pos);
    }
  }, [showFlowNavTip, flowNavTipStep, computeAnchorPos, flowTips]);
  const dismissConsultTip = useCallback(() => {
    setShowConsultTip(false);
    try { localStorage.setItem('studio_consult_tip_dismissed', '1'); } catch {}
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!initialDesc || didInitRef.current || hasGenerated) return;
    
    didInitRef.current = true;
    setHasGenerated(true);
    setLoading(true);
    
    const generate = async () => {
      try {
        const { generateProposal: aiGenerateProposal } = await import('../services/ai');
        const locale = (document.documentElement.lang || 'pt') as 'pt' | 'en';
        
        console.log('🔍 Gerando com IA...', { description: initialDesc.substring(0, 50) + '...' });
        
        const aiProposal = await aiGenerateProposal(initialDesc, locale);
        
        if (aiProposal) {
          console.log('✅ IA gerou proposta com sucesso!', aiProposal);
          setProposal(aiProposal);
          const timelineText = aiProposal.timeline.map(t => `${t.phase} — ${t.duration}: ${t.details}`).join('\n');
          const projectSummary = `\n\n${t('studio.projectSummary')}:\n${aiProposal.summary}`;
          const fullResponse = `${t('studio.suggestedSchedule')}:\n${timelineText}${projectSummary}`;
          
          setMessages(prev => {
            const newMessages = [...prev, { role: 'assistant' as const, content: '', isStreaming: true }];
            const messageIndex = newMessages.length - 1;
            streamTokens(fullResponse, messageIndex);
            return newMessages;
          });
        } else {
          console.log('❌ IA retornou null - sem proposta gerada');
          const errorMessage = '⚠️ Cota da API excedida. Você já usou as 50 requisições gratuitas do dia. Aguarde 24h ou configure billing no Google Cloud Console.';
          
          setMessages(prev => {
            const newMessages = [...prev, { role: 'assistant' as const, content: '', isStreaming: true }];
            const messageIndex = newMessages.length - 1;
            streamTokens(errorMessage, messageIndex);
            return newMessages;
          });
        }
      } catch (error) {
        console.error('❌ Erro na geração com IA:', error);
        const errorMessage = t('studio.error.communication');
        setMessages(prev => {
          const newMessages = [...prev, { role: 'assistant' as const, content: '', isStreaming: true }];
          const messageIndex = newMessages.length - 1;
          streamTokens(errorMessage, messageIndex);
          return newMessages;
        });
      } finally {
        setLoading(false);
      }
    };
    
    generate();
  }, [initialDesc, hasGenerated]);

  useEffect(() => {
    const id = sessionId.current;
    const payload = { initialDesc, messages, proposal };
    const leadId = (() => { try { return localStorage.getItem('leadId') || undefined; } catch { return undefined; } })();
    const t = setTimeout(() => {
      upsertStudioState(id, payload, leadId).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [initialDesc, messages, proposal]);

  // Função para simular streaming de tokens com formatação em tempo real
  const streamTokens = useCallback(async (fullText: string, messageIndex: number) => {
    const lines = fullText.split('\n');
    let currentText = '';
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const words = line.split(' ');
      
      // Adicionar quebra de linha se não for a primeira linha
      if (lineIndex > 0) {
        currentText += '\n';
      }
      
      // Stream palavra por palavra dentro da linha
      for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        await new Promise(resolve => setTimeout(resolve, 80));
        currentText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
        
        // Atualizar o estado com formatação aplicada
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages[messageIndex]) {
            newMessages[messageIndex] = { 
              ...newMessages[messageIndex], 
              content: currentText,
              isStreaming: lineIndex < lines.length - 1 || wordIndex < words.length - 1
            };
          }
          return newMessages;
        });
      }
    }
  }, []);

  const send = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    const newMessages = [...messages, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: t('studio.thinking'), isStreaming: true }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { generateProposal: aiGenerateProposal } = await import('../services/ai');
      const locale = (document.documentElement.lang || 'pt') as 'pt' | 'en';
      const combinedDescription = buildDescriptionFromHistory(text);
      
      const aiProposal = await aiGenerateProposal(combinedDescription, locale);
      
      setMessages(prev => {
          const withoutThinking = prev.slice(0, -1);
      if (aiProposal) {
        console.log('✅ IA atualizou proposta com sucesso!', aiProposal);
        setProposal(aiProposal);
        const timelineText = aiProposal.timeline.map(t => `${t.phase} — ${t.duration}: ${t.details}`).join('\n');
        const projectSummary = `\n\n${t('studio.projectSummary')}:\n${aiProposal.summary}`;
        const fullResponse = `${t('studio.scheduleUpdated')}:\n${timelineText}${projectSummary}`;
        
        // Iniciar streaming de tokens
        const messageIndex = withoutThinking.length;
        const newMessages = [...withoutThinking, { role: 'assistant' as const, content: '', isStreaming: true }];
        streamTokens(fullResponse, messageIndex);
        
        return newMessages;
      } else {
        console.log('❌ IA retornou null - sem atualização');
        const errorMessage = t('studio.error.updateFailed');
        const messageIndex = withoutThinking.length;
        const newMessages = [...withoutThinking, { role: 'assistant' as const, content: '', isStreaming: true }];
        streamTokens(errorMessage, messageIndex);
        
        return newMessages;
          }
        });
    } catch (error) {
      console.error('❌ Erro na atualização com IA:', error);
      setMessages(prev => {
        const withoutThinking = prev.slice(0, -1);
        const errorMessage = t('studio.error.communication');
        const messageIndex = withoutThinking.length;
        const newMessages = [...withoutThinking, { role: 'assistant' as const, content: '', isStreaming: true }];
        streamTokens(errorMessage, messageIndex);
        
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  }, [input, messages, initialDesc, buildDescriptionFromHistory, streamTokens, t]);

  // Hook para detectar mudanças de tamanho da tela
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ANOTAÇÃO: useMemo para evitar recalcular o fluxo em cada renderização, a menos que a proposta mude.
  const flowData = useMemo(() => {
    if (!proposal) return null;

    // Layout responsivo: 1 coluna no mobile, múltiplas no desktop
    const baseX = isMobile ? 100 : 220;
    const stepX = isMobile ? 0 : 420; // 1 coluna no mobile (stepX = 0)
    const baseY = isMobile ? 100 : 220;
    const stepY = isMobile ? 120 : 180;
    const maxRowsPerColumn = isMobile ? 20 : 4; // Muitos nós na mesma coluna no mobile
    
    const colors: NodeData['color'][] = ['lime','sky','accent','primary','slate'];
    // Input sempre na primeira coluna, junto com o fluxo
    const nodes: NodeData[] = [{ id: 'input', title: t('studio.inputNode'), subtitleLines: [proposal.summary], color: 'lime', x: baseX, y: baseY }];
    const edges: Array<{ from: string; to: string }> = [];

    let col = 0, row = 1, lastNodeId = 'input', totalNodesInCurrentColumn = 1; // col = 0 para começar na primeira coluna
    
    // Construir nós a partir do cronograma para espelhar exatamente o que é exibido no "Cronograma"
    proposal.timeline.forEach((item, idx) => {
      const nodeId = `tl-${idx}`;
        const x = isMobile ? baseX : baseX + col * stepX;
        const y = isMobile ? baseY + row * stepY : baseY + row * stepY;
      const title = item.phase;
      const subtitleLines = [item.duration, item.details].filter(Boolean);
        
      nodes.push({ id: nodeId, title, subtitleLines, color: colors[idx % colors.length], x, y });
        edges.push({ from: lastNodeId, to: nodeId });
        lastNodeId = nodeId;
        row++;
        totalNodesInCurrentColumn++;
        
        // No mobile, não quebra coluna - todos ficam empilhados
        if (!isMobile && row >= maxRowsPerColumn) { 
          row = 0; 
          col++; 
          totalNodesInCurrentColumn = 0;
        }
    });
    
    // Posicionamento do Output: na mesma coluna no mobile, última coluna no desktop
    const outputX = isMobile ? baseX : baseX + col * stepX;
    // No mobile, fica no final da pilha vertical
    const outputY = isMobile ? baseY + row * stepY : baseY + row * stepY;
    
    // Gerar conteúdo dinâmico para o nó Output (sem truncar)
    const outputContent: string[] = [];
    if (proposal.summary) {
      outputContent.push(`${t('studio.outputLabels.summary')}: ${proposal.summary}`);
    }
    if (proposal.timeline && proposal.timeline.length > 0) {
      outputContent.push(`${t('studio.outputLabels.timeline')}: ${proposal.timeline.length} ${t('studio.outputLabels.phases')}`);
      const locale = (document.documentElement.lang || 'pt') as 'pt' | 'en';
      const range = computeTimelineDurationRange(proposal.timeline, locale);
      if (range) {
        outputContent.push(`${t('studio.outputLabels.estimatedDuration')}: ${range}`);
      }
    }
    if (proposal.sections && proposal.sections.length > 0) {
      outputContent.push(`${proposal.sections.length} ${t('studio.outputLabels.technicalSections')}`);
    }
    outputContent.push(`${t('studio.outputLabels.nextSteps')}: ${t('studio.outputLabels.implementation')}`);
    
    nodes.push({ id: 'output', title: t('studio.outputNode'), subtitleLines: outputContent, color: 'accent', x: outputX, y: outputY });
    edges.push({ from: lastNodeId, to: 'output' });
    
    // Altura baseada no número de nós empilhados
    const h = isMobile ? Math.max(400, (row + 1) * stepY + 200) : Math.max(650, (row + 1) * stepY + 400);
    return { nodes, edges, height: h };
  }, [proposal, isMobile]);

  // ANOTAÇÃO: useCallback para memoizar a função e evitar recriações desnecessárias.
  const exportPdf = useCallback(async () => {
    if (!proposal) return;
    
    // Detectar Safari mobile para mostrar feedback
    const isSafariMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isMobileDevice = window.innerWidth < 768;
    
    if (isSafariMobile || isMobileDevice) {
      // Mostrar feedback para Safari mobile e mobile
      const originalText = document.querySelector('.flow-container .absolute.bottom-20 button.bg-accent-700')?.textContent;
      const button = document.querySelector('.flow-container .absolute.bottom-20 button.bg-accent-700') as HTMLButtonElement;
      if (button) {
        button.textContent = t('studio.generatingPDF') || 'Gerando PDF...';
        button.disabled = true;
      }
      
      // Restaurar botão após um tempo
      setTimeout(() => {
        if (button && originalText) {
          button.textContent = originalText;
          button.disabled = false;
        }
      }, 4000);
    }
    
             const originalConsoleError = console.error;
    // ANOTAÇÃO: Suprimir um erro específico e conhecido da biblioteca de imagem.
    // Isso pode ser arriscado, pois pode ocultar outros erros. Use com cautela.
             console.error = (...args) => {
      if (args[0]?.includes?.('removeChild') || args[0]?.includes?.('NotFoundError')) return;
               originalConsoleError.apply(console, args);
             };
             
             try {
               const doc = new jsPDF({ unit: 'pt', format: 'a4' });
               
               // Função para adicionar rodapé em todas as páginas
               const addFooter = () => {
                 const pageHeight = doc.internal.pageSize.getHeight();
                 const pageWidth = doc.internal.pageSize.getWidth();
                 const footerY = pageHeight - 20;
                 
                 doc.setFont('helvetica', 'normal');
                 doc.setFontSize(10);
                 doc.setTextColor(100, 100, 100);
                 
                 // Centralizar o texto do rodapé
                 const footerText = t('studio.pdfSubtitle');
                 const textWidth = doc.getTextWidth(footerText);
                 const textX = (pageWidth - textWidth) / 2;
                 doc.text(footerText, textX, footerY);
               };
               
               // Adicionar rodapé na primeira página
               addFooter();
               
      // ... (O conteúdo da função de PDF permanece o mesmo, pois é bem procedural)
      // O código original para gerar o PDF está correto e foi mantido aqui.
               const margin = 32;
               let y = margin;

               // Adicionar logo da SUAIDEN melhorada
               try {
                 // Criar um canvas temporário para converter a logo
                 const canvas = document.createElement('canvas');
                 const ctx = canvas.getContext('2d');
                 const img = new Image();
                 
                 // Aguardar o carregamento da imagem
                 await new Promise((resolve, reject) => {
                   img.onload = () => {
                     // Calcular proporção correta da logo
                     const maxWidth = 120;
                     const aspectRatio = img.width / img.height;
                     const logoWidth = maxWidth;
                     const logoHeight = maxWidth / aspectRatio;
                     
                     canvas.width = logoWidth;
                     canvas.height = logoHeight;
                     
                     if (ctx) {
                       // Melhorar a qualidade da imagem
                       ctx.imageSmoothingEnabled = true;
                       ctx.imageSmoothingQuality = 'high';
                       ctx.drawImage(img, 0, 0, logoWidth, logoHeight);
                       const logoDataUrl = canvas.toDataURL('image/png', 1.0);
                       
                       // Adicionar logo no PDF centralizada
                       const pageWidth = doc.internal.pageSize.getWidth();
                       const logoX = (pageWidth - logoWidth) / 2;
                       doc.addImage(logoDataUrl, 'PNG', logoX, y, logoWidth, logoHeight);
                     }
                     resolve(true);
                   };
                   img.onerror = reject;
                   img.src = '/logo-suaiden.png';
                 });
                 
                 y += 100;
               } catch (logoError) {
                 console.warn('Erro ao carregar logo, usando texto:', logoError);
                 // Fallback para texto se a logo não carregar
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(28);
                 doc.setTextColor(139, 92, 246);
                 const pageWidth = doc.internal.pageSize.getWidth();
                 const textWidth = doc.getTextWidth(t('studio.pdfTitle'));
                 const textX = (pageWidth - textWidth) / 2;
                 doc.text(t('studio.pdfTitle'), textX, y);
                 y += 40;
               }

               doc.setDrawColor(200, 200, 200);
               doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
               y += 60;

      if (proposal.summary) {
        doc.setTextColor(0, 0, 0);
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(18);
                 doc.text(t('studio.pdfProjectSummary'), margin, y);
                 y += 25;
                 
                 doc.setFont('helvetica', 'normal');
                 doc.setFontSize(12);
                 doc.setTextColor(60, 60, 60);
                 const summary = doc.splitTextToSize(proposal.summary, 520);
                 doc.text(summary, margin, y);
                 y += summary.length * 15 + 25;
               }

      if (proposal.timeline?.length) {
                 if (y > doc.internal.pageSize.getHeight() - 150) {
                   doc.addPage();
                   addFooter();
                   y = margin;
                 }
                 doc.setTextColor(0, 0, 0);
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(18);
                 doc.text(t('studio.pdfSuggestedTimeline'), margin, y);
                 y += 25;
                 doc.setFont('helvetica', 'normal');
                 doc.setFontSize(11);
                 proposal.timeline.forEach((t, index) => {
                   if (y > doc.internal.pageSize.getHeight() - 80) {
                     doc.addPage();
                     addFooter();
                     y = margin;
                   }
                   // Número da fase
                   doc.setFillColor(139, 92, 246);
                   doc.circle(margin + 10, y + 8, 8, 'F');
                   doc.setTextColor(255, 255, 255);
                   doc.setFont('helvetica', 'bold');
                   doc.setFontSize(10);
                   doc.text(String(index + 1), margin + 10, y + 12);
                   
                   // Conteúdo da fase
                   doc.setTextColor(0, 0, 0);
                   doc.setFont('helvetica', 'bold');
                   doc.setFontSize(12);
                   doc.text(t.phase, margin + 30, y + 8);
                   doc.setFont('helvetica', 'normal');
                   doc.setFontSize(10);
                   doc.setTextColor(100, 100, 100);
                   doc.text(t.duration, margin + 30, y + 20);
                   const details = doc.splitTextToSize(t.details, 480);
                   doc.setTextColor(60, 60, 60);
                   doc.text(details, margin + 30, y + 30);
                   y += details.length * 12 + 25;
                 });
                 y += 30;
               }

               // Adicionar informações dos nós do fluxo em formato de texto
               if (flowData) {
        if (y > doc.internal.pageSize.getHeight() - 200) { doc.addPage(); addFooter(); y = margin; }
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(18);
                 doc.setTextColor(0, 0, 0);
                 doc.text(t('studio.pdfFlowDetails'), margin, y);
                 y += 40;
                 
                 // Adicionar informações de cada nó
                 flowData.nodes.forEach((node, index) => {
          if (y > doc.internal.pageSize.getHeight() - 100) { doc.addPage(); addFooter(); y = margin; }
                   
                   // Cabeçalho do nó com design melhorado
                   const nodeHeight = 30;
                   doc.setFillColor(139, 92, 246);
                   doc.roundedRect(margin, y - 8, doc.internal.pageSize.getWidth() - margin * 2, nodeHeight, 6, 6, 'F');
                   doc.setTextColor(255, 255, 255);
                   doc.setFont('helvetica', 'bold');
                   doc.setFontSize(13);
                   doc.text(`${index + 1}. ${node.title}`, margin + 15, y + 12);
                   y += nodeHeight + 15;
                   
                   // Conteúdo do nó
                   doc.setTextColor(0, 0, 0);
                   doc.setFont('helvetica', 'normal');
                   doc.setFontSize(10);
                   
                   if (node.subtitleLines && node.subtitleLines.length > 0) {
                     node.subtitleLines.forEach((line) => {
            if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); addFooter(); y = margin; }
                       doc.setFillColor(139, 92, 246);
                       doc.circle(margin + 10, y + 6, 3, 'F');
                       const wrapped = doc.splitTextToSize(line, 480);
                       doc.setTextColor(60, 60, 60);
                       doc.text(wrapped, margin + 20, y + 8);
                       y += wrapped.length * 12 + 10;
                     });
                     y += 15;
                   }
                 });
                 
               }


      // Detectar Safari mobile e usar abordagem diferente
      const isSafariMobileDownload = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      const isMobileDownload = window.innerWidth < 768;
      
      if (isSafariMobileDownload || isMobileDownload) {
        // Para Safari mobile e mobile em geral, usar blob com fallback
        try {
          const pdfBlob = doc.output('blob');
          const url = URL.createObjectURL(pdfBlob);
          
          // Criar link temporário
          const link = document.createElement('a');
          link.href = url;
          link.download = 'relatorio-suaiden-ai.pdf';
          link.style.display = 'none';
          document.body.appendChild(link);
          
          // Forçar download
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          link.dispatchEvent(clickEvent);
          
          // Limpar após download
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }, 2000);
          
        } catch (error) {
          // Fallback: abrir em nova aba
          console.warn('Download direto falhou, abrindo em nova aba:', error);
          const pdfDataUri = doc.output('datauristring');
          window.open(pdfDataUri, '_blank');
        }
      } else {
        // Para desktop, usar o método padrão
        doc.save('relatorio-suaiden-ai.pdf');
      }
             } catch (error) {
               console.error('Erro ao gerar PDF:', error);
             } finally {
               console.error = originalConsoleError;
             }
  }, [proposal, flowData, t]);

  const handleScheduleConsultation = useCallback((data: any) => {
    console.log('Agendamento solicitado:', data);
    // Feedback inline é exibido dentro do próprio modal; nada a fazer aqui.
  }, []);

  return (
    <div className={`min-h-screen md:grid md:grid-cols-1 ${isChatHidden ? 'md:grid-cols-1' : 'md:grid-cols-[420px_1fr]'} bg-zinc-900 relative`}>
      {/* Loading Overlay - Cobre toda a página do Studio */}
      {isGeneratingFlow && (
        <div className="fixed inset-0 bg-zinc-900 z-50 flex items-center justify-center">
          <div className="text-center">
            {/* Loading com logo da Suaiden */}
            <div className="relative mb-12">
              {/* Logo principal com animação */}
              <div className="relative">
                <img 
                  src="/Logo_Suaiden.png" 
                  alt="Suaiden Logo" 
                  className="h-16 w-auto mx-auto animate-logo-pulse"
                />
                {/* Efeito de brilho ao redor da logo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 animate-ping"></div>
                </div>
                {/* Círculos orbitais ao redor da logo */}
                <div className="absolute inset-0 animate-smooth-rotate" style={{animationDuration: '6s'}}>
                  <div className="w-1 h-1 bg-primary-400 rounded-full absolute top-2 left-1/2 transform -translate-x-1/2 animate-fade-in-out"></div>
                  <div className="w-1 h-1 bg-accent-400 rounded-full absolute bottom-2 left-1/2 transform -translate-x-1/2 animate-fade-in-out" style={{animationDelay: '0.8s'}}></div>
                  <div className="w-1 h-1 bg-primary-400 rounded-full absolute left-2 top-1/2 transform -translate-y-1/2 animate-fade-in-out" style={{animationDelay: '1.6s'}}></div>
                  <div className="w-1 h-1 bg-accent-400 rounded-full absolute right-2 top-1/2 transform -translate-y-1/2 animate-fade-in-out" style={{animationDelay: '2.4s'}}></div>
                </div>
              </div>
            </div>
            
            {/* Texto minimalista */}
            <h3 className="text-xl font-medium text-white mb-2 tracking-wide">
              {t('studio.generatingFlow')}
            </h3>
            
            <p className="text-slate-400 text-sm font-light">
              {t('studio.creatingFlow')}
            </p>
          </div>
        </div>
      )}
      
      {/* Left: Chat */}
      <div className={`border-r border-zinc-800 max-h-screen h-screen ${mobileView === 'flow' ? 'hidden md:flex' : 'flex md:flex'} ${isChatHidden ? 'md:hidden' : ''} flex-col relative chat-container`}>
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 chat-header">
          <button onClick={() => window.location.hash = ''} className="flex items-center gap-2 text-white hover:text-primary-400 transition-colors">
            <FontAwesomeIcon icon={solidIcons.faArrowRight} size="sm" className="rotate-180" />
            <span className="font-medium text-sm">{t('studio.backToHome')}</span>
          </button>
          <div className="md:hidden relative z-20 flex items-center gap-2">
            <button id="btn-view-flow" onClick={() => { setMobileView('flow'); dismissFlowTip(); }} disabled={!proposal} className={`text-xs px-3 py-2 rounded-lg border transition-colors relative z-20 ${proposal ? 'text-white border-slate-600 hover:bg-slate-800' : 'text-slate-500 border-slate-800 opacity-60'}`}>
              {t('studio.viewFlow')}
            </button>
            <button
              type="button"
              aria-label="Ajuda"
              className="text-slate-300 hover:text-white text-xs px-2 py-2 rounded-md border border-slate-700"
              onClick={() => {
                if (mobileView === 'chat') {
                  // Sequência nova: visualizar fluxo -> consultoria
                  const flowDismissed = (() => { try { return localStorage.getItem('studio_flow_tip_dismissed') === '1'; } catch { return false; } })();
                  const consultDismissed = (() => { try { return localStorage.getItem('studio_consult_tip_dismissed') === '1'; } catch { return false; } })();
                  if (!flowDismissed) {
                    setShowFlowTip(true);
                    setShowConsultTip(false);
                  } else if (!consultDismissed) {
                    setShowConsultTip(true);
                  } else {
                    setShowFlowTip(true);
                    setShowConsultTip(false);
                  }
                } else {
                  setShowFlowNavTip(true);
                }
              }}
            >?
            </button>
            {showFlowTip && proposal && (
              <div className="absolute top-full mt-2 right-0 left-auto w-64 bg-slate-900/95 border border-slate-700 rounded-lg shadow-lg p-3 z-30">
                {/* Botão próximo (ícone) */}
                <button
                  type="button"
                  aria-label="Próxima dica"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-violet-600/90 text-white text-xs flex items-center justify-center hover:bg-violet-600"
                  onClick={() => { dismissFlowTip(); setShowConsultTip(true); }}
                >
                  <FontAwesomeIcon icon={solidIcons.faChevronRight} size="sm" />
                </button>
                <div className="text-[11px] text-white font-semibold mb-1">Visualize o fluxo do projeto</div>
                <div className="text-[11px] text-slate-300">Toque em "{t('studio.viewFlow')}" para ver o cronograma gerado como etapas conectadas.</div>
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => { setMobileView('flow'); dismissFlowTip(); }} className="px-2 py-1 rounded-md bg-violet-600 text-white text-[11px]">{t('studio.viewFlow')}</button>
                  <button onClick={dismissFlowTip} className="px-2 py-1 rounded-md border border-slate-600 text-slate-200 text-[11px]">Fechar</button>
                </div>
                <span className="absolute -top-2 right-3 w-3 h-3 rotate-45 bg-slate-900 border-l border-t border-slate-700" />
              </div>
            )}
          </div>
        </div>
        
        {/* Chat Close Button - Outside the chat, on the right edge */}
        {!isChatHidden && (
          <button 
            type="button" 
            aria-label={t('studio.hideChat')} 
            title={t('studio.hideChat')} 
            onClick={() => setIsChatHidden(true)} 
            className={`hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-14 rounded-r-2xl rounded-l-md bg-slate-900 backdrop-blur border border-slate-700 shadow-xl hover:bg-slate-800 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 z-10 ${edgeHintPulse ? 'animate-pulse' : ''}`}
          >
            <FontAwesomeIcon icon={solidIcons.faChevronLeft} size="sm" />
          </button>
        )}
        
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar chat-messages bg-zinc-900">
          {messages.map((m, i) => (
            <div key={i} className={`${m.role === 'user' ? 'ml-12' : ''}`}>
              <div className={`px-4 py-3 whitespace-pre-line text-sm leading-relaxed ${m.role === 'user' ? 'bg-slate-700 text-white rounded-xl border border-slate-600' : 'text-white/90 w-full'}`}>
                {m.role === 'assistant' ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <img 
                        src="/Logo_Suaiden.png" 
                        alt="Suaiden Logo" 
                        className="h-4 w-auto"
                      />
                      <span className="font-semibold text-violet-400 text-sm">{t('studio.suaidenAI')}</span>
                    </div>
                    <div className="leading-relaxed text-gray-200 break-words whitespace-pre-wrap">
                        {m.content === t('studio.thinking') ? <ThinkingIndicator t={t} /> : (
                          <div>
                            <AssistantMessage content={m.content} isStreaming={m.isStreaming} />
                            {m.isStreaming && (
                                <span className="inline-block w-2 h-4 bg-violet-400 ml-1 animate-pulse"></span>
                            )}
                          </div>
                        )}
                    </div>
                    {m.content !== t('studio.thinking') && !m.isStreaming && (
                       <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <button className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${aiFeedback[i] === 'up' ? 'text-primary-400' : ''}`} aria-label={t('studio.like')} onClick={() => setAiFeedback(prev => ({ ...prev, [i]: prev[i] === 'up' ? undefined : 'up' }))}><FontAwesomeIcon icon={solidIcons.faThumbsUp} size="sm" /></button>
                        <button className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${aiFeedback[i] === 'down' ? 'text-primary-400' : ''}`} aria-label={t('studio.dislike')} onClick={() => setAiFeedback(prev => ({ ...prev, [i]: prev[i] === 'down' ? undefined : 'down' }))}><FontAwesomeIcon icon={solidIcons.faThumbsDown} size="sm" /></button>
                        <div className="relative group inline-block">
                          <button
                            className="p-1.5 rounded-md hover:bg-slate-800 transition-colors"
                            aria-label={t('studio.copy')}
                            onClick={() => {
                            try {
                              const text = m.content || '';
                              if (navigator?.clipboard?.writeText) {
                                navigator.clipboard.writeText(text).catch(() => {
                                  // fallback
                                  const ta = document.createElement('textarea');
                                  ta.value = text;
                                  ta.style.position = 'fixed';
                                  ta.style.left = '-9999px';
                                  document.body.appendChild(ta);
                                  ta.select();
                                  try { document.execCommand('copy'); } catch {}
                                  document.body.removeChild(ta);
                                });
                              } else {
                                const ta = document.createElement('textarea');
                                ta.value = text;
                                ta.style.position = 'fixed';
                                ta.style.left = '-9999px';
                                document.body.appendChild(ta);
                                ta.select();
                                try { document.execCommand('copy'); } catch {}
                                document.body.removeChild(ta);
                                // feedback visual rápido no tooltip
                                const el = (event?.currentTarget as HTMLElement)?.parentElement?.querySelector('.copy-tooltip');
                                if (el) {
                                  const original = (el as HTMLElement).getAttribute('data-original') || el.textContent || '';
                                  (el as HTMLElement).setAttribute('data-original', original);
                                  el.textContent = t('studio.copied') || 'Copiado!';
                                  el.classList.add('opacity-100');
                                  el.classList.remove('opacity-0');
                                  setTimeout(() => {
                                    el.textContent = original;
                                    el.classList.remove('opacity-100');
                                    el.classList.add('opacity-0');
                                  }, 1200);
                                }
                              }
                            } catch {}
                            }}
                          >
                            <FontAwesomeIcon icon={solidIcons.faCopy} size="sm" />
                          </button>
                          <span className="copy-tooltip pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] bg-slate-800 text-white px-2 py-1 rounded-md shadow opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {t('studio.copy')}
                            <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-800"></span>
                          </span>
                        </div>
                        
                      </div>
                    )}
                    {/* Botão de agendamento logo após a última mensagem da IA + dica mobile */}
                    {m.role === 'assistant' && !m.isStreaming && i === messages.length - 1 && (
                      <div className="mt-3 relative">
                        <Button
                          size="sm"
                          variant="outline"
                          className="group w-full sm:w-auto inline-flex items-center gap-2 !bg-white !text-slate-900 hover:!bg-slate-50 !border-slate-200/70 rounded-xl px-4 py-2 shadow-md hover:shadow-lg ring-1 ring-slate-200/70 transition-all duration-200 hover:scale-[1.01] md:hidden"
                          onClick={() => { setIsSchedulingModalOpen(true); dismissConsultTip(); }}
                        >
                          <FontAwesomeIcon icon={solidIcons.faCalendar} className="text-slate-700" size="sm" />
                          <span>{language === 'pt' ? 'Agendar consultoria' : t('studio.requestConsultation')}</span>
                          <FontAwesomeIcon icon={solidIcons.faChevronRight} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" size="sm" />
                        </Button>
                        {/* Dica mobile ancorada ao botão */}
                        {showConsultTip && (
                          <div className="sm:hidden absolute top-full mt-2 left-0 right-0 bg-slate-900/95 border border-slate-700 rounded-lg shadow-lg p-3 z-40">
                            {/* Voltar para dica anterior (ícone) */}
                            <button
                              type="button"
                              aria-label="Dica anterior"
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-700/90 text-white text-xs flex items-center justify-center hover:bg-slate-700"
                              onClick={() => { dismissConsultTip(); setShowFlowTip(true); }}
                            >
                              <FontAwesomeIcon icon={solidIcons.faChevronLeft} size="sm" />
                            </button>
                            <div className="text-[11px] text-white font-semibold mb-1">Agende uma conversa de 60 minutos</div>
                            <div className="text-[11px] text-slate-300">Toque em “{language === 'pt' ? 'Agendar consultoria' : t('studio.requestConsultation')}” para combinarmos uma call rápida e tirar dúvidas.</div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button onClick={() => { setIsSchedulingModalOpen(true); dismissConsultTip(); }} className="px-2 py-1 rounded-md bg-violet-600 text-white text-[11px]">{language === 'pt' ? 'Agendar consultoria' : t('studio.requestConsultation')}</button>
                              <button onClick={dismissConsultTip} className="px-2 py-1 rounded-md border border-slate-600 text-slate-200 text-[11px]">Fechar</button>
                            </div>
                            <span className="absolute -top-2 left-10 w-3 h-3 rotate-45 bg-slate-900 border-l border-t border-slate-700" />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-white font-medium">{m.content}</div>
                )}
              </div>
            </div>
          ))}
          {messages.length === 0 && <div className="text-slate-500 text-xs text-center mt-8">{t('studio.startDescribing')}</div>}
          <div ref={messagesEndRef} />
        </div>
        {/* Botão de ajuda flutuante: somente mobile no chat (no desktop deixamos apenas no Flow) */}
        <button
          type="button"
          aria-label="Ajuda"
          className="md:hidden absolute bottom-24 right-3 z-40 w-10 h-10 rounded-full bg-violet-600 text-white shadow-lg ring-1 ring-white/10 flex items-center justify-center active:scale-95"
          onClick={() => {
            const flowDismissed = (() => { try { return localStorage.getItem('studio_flow_tip_dismissed') === '1'; } catch { return false; } })();
            const consultDismissed = (() => { try { return localStorage.getItem('studio_consult_tip_dismissed') === '1'; } catch { return false; } })();
            if (!flowDismissed) {
              setShowFlowTip(true);
              setShowConsultTip(false);
            } else if (!consultDismissed) {
              setShowConsultTip(true);
            } else {
              setShowFlowTip(true);
              setShowConsultTip(false);
            }
          }}
        >
          ?
        </button>
        
        <div className="flex-shrink-0 p-6 bg-zinc-900 border-t border-zinc-800 chat-input relative z-30">
          <ChatInput value={input} onChange={setInput} onSend={send} loading={loading} placeholder={t('studio.askSuaiden')} />
        </div>
        
      </div>
      
      {/* Right: Flow + Proposal */}
      <div className={`h-screen relative ${mobileView === 'chat' ? 'hidden md:flex' : 'flex md:flex'} flex-col flow-container bg-zinc-900`}>
        <div className="flex-none px-4 pt-4 pb-2 relative z-20 flow-header">
          <div className="w-full flex items-center justify-between">
            <span className="text-white/90 font-medium">{t('studio.proposedFlow')}</span>
            <div className="flex items-center gap-2">
              {/* Ajuda (mobile) no header ao lado do Voltar para chat */}
              <button id="flow-help-button" type="button" aria-label="Ajuda Fluxo" className="md:hidden w-8 h-8 rounded-full bg-violet-600 text-white shadow ring-1 ring-white/10 flex items-center justify-center active:scale-95"
                onClick={openFlowNavTip}>?
              </button>
              <button className="md:hidden text-xs px-3 py-2 rounded-lg border border-slate-600 text-white hover:bg-slate-800 transition-colors relative z-40" onClick={() => setMobileView('chat')}>
                {t('studio.backToChat')}
              </button>
            </div>
          </div>
        </div>
        
        <div id="flow-canvas-container" ref={flowCanvasContainerRef} className="flex-1 flex flex-col min-h-0 overflow-auto rounded-2xl flow-canvas relative">
          {flowData && <FlowCanvas ref={flowRef} nodes={flowData.nodes} edges={flowData.edges} height={flowData.height} />}
          {/* Botão de ajuda flutuante no Flow (apenas desktop) */}
          <button id="flow-help-button"
            type="button"
            aria-label="Ajuda Fluxo"
            className="hidden sm:flex absolute bottom-6 right-4 z-40 w-10 h-10 rounded-full bg-violet-600 text-white shadow-lg ring-1 ring-white/10 items-center justify-center active:scale-95"
            onClick={openFlowNavTip}
          >
            ?
          </button>
          {/* Tip desktop no Flow (posicionada acima do botão) */}
          {showFlowNavTip && (
            <div className="hidden sm:flex flex-col absolute w-[min(32rem,60vw)] max-w-[420px] bg-slate-900/95 border border-slate-700 rounded-lg shadow-lg p-3 z-40"
                 style={flowDesktopTipPos ? { left: flowDesktopTipPos.x, top: flowDesktopTipPos.y } : { bottom: 80, right: 16 }}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12px] text-white font-semibold mb-1">{flowTips[flowNavTipStep].title}</div>
                <div className="flex items-center gap-1">
                  {/* indicadores */}
                  {flowTips.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === flowNavTipStep ? 'bg-violet-400' : 'bg-slate-600'} `} />
                  ))}
                </div>
              </div>
              <div className="text-[12px] text-slate-300">{flowTips[flowNavTipStep].text}</div>
              <div className="mt-2 flex justify-between gap-2">
                <div className="flex gap-2">
                  <button disabled={flowNavTipStep === 0} onClick={() => setFlowNavTipStep(s => Math.max(0, s - 1))} className={`px-2 py-1 rounded-md border text-[12px] ${flowNavTipStep === 0 ? 'text-slate-500 border-slate-700 cursor-not-allowed' : 'text-slate-200 border-slate-600 hover:bg-slate-800'}`}>{t('studio.tips.prev')}</button>
                  <button disabled={flowNavTipStep === flowTips.length - 1} onClick={() => setFlowNavTipStep(s => Math.min(flowTips.length - 1, s + 1))} className={`px-2 py-1 rounded-md border text-[12px] ${flowNavTipStep === flowTips.length - 1 ? 'text-slate-500 border-slate-700 cursor-not-allowed' : 'text-slate-200 border-slate-600 hover:bg-slate-800'}`}>{t('studio.tips.next')}</button>
                </div>
                <button onClick={() => { setShowFlowNavTip(false); try { localStorage.setItem('studio_flow_nav_tip_dismissed', '1'); } catch {} }} className="px-2 py-1 rounded-md border border-slate-600 text-slate-200 text-[12px]">{t('studio.tips.close')}</button>
              </div>
            </div>
          )}
        </div>
        
        {isChatHidden && (
          <button type="button" aria-label={t('studio.showChat')} title={t('studio.showChat')} onClick={() => setIsChatHidden(false)} className={`hidden md:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 w-6 h-14 rounded-l-2xl rounded-r-md bg-primary-600/95 backdrop-blur border border-primary-500 shadow-xl hover:bg-primary-500 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${edgeHintPulse ? 'animate-pulse' : ''}`}>
            <FontAwesomeIcon icon={solidIcons.faChevronRight} size="sm" />
          </button>
        )}
        {!loading && (
          <div className="fixed bottom-4 left-2 right-2 sm:absolute sm:bottom-6 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:px-4 sm:w-auto max-w-[calc(100vw-1rem)] sm:max-w-none">
          <Button id="btn-flow-consult"
            variant="secondary" 
            size="md"
            className="bg-slate-800/90 hover:bg-slate-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border-0 ring-1 ring-slate-700/50 backdrop-blur-sm w-full sm:w-auto" 
            onClick={() => setIsSchedulingModalOpen(true)}
          >
            <FontAwesomeIcon icon={solidIcons.faCalendar} className="mr-1 sm:mr-2" size="sm" />
            <span className="truncate">
              <span className="sm:hidden">Consultoria</span>
              <span className="hidden sm:inline">{t('studio.requestConsultation')}</span>
            </span>
          </Button>
          {/* Dica 3: Agendar consultoria (mobile) */}
          {showConsultTip && (
            <div className="sm:hidden absolute bottom-full mb-6 left-1/2 -translate-x-1/2 w-[min(92vw,360px)] bg-slate-900/95 border border-slate-700 rounded-lg shadow-lg p-3 z-40">
              <div className="text-[11px] text-white font-semibold mb-1">Agende uma conversa de 60 minutos</div>
              <div className="text-[11px] text-slate-300">Toque em “{t('studio.requestConsultation')}” para combinarmos uma call rápida e tirar dúvidas.</div>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => { setIsSchedulingModalOpen(true); dismissConsultTip(); }} className="px-2 py-1 rounded-md bg-violet-600 text-white text-[11px]">{t('studio.requestConsultation')}</button>
                <button onClick={dismissConsultTip} className="px-2 py-1 rounded-md border border-slate-600 text-slate-200 text-[11px]">Entendi</button>
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-slate-700" />
            </div>
          )}
          {/* Dica 2: Navegação no fluxo (mobile) */}
          {showFlowNavTip && mobileView === 'flow' && (
            <div className="sm:hidden absolute -top-24 left-1/2 -translate-x-1/2 w-[min(92vw,320px)] bg-slate-900/95 border border-slate-700 rounded-lg shadow-lg p-3 z-40">
              <div className="text-[11px] text-white font-semibold mb-1">Navegue entre as etapas</div>
              <div className="text-[11px] text-slate-300">Arraste para mover o canvas, dê pinça para zoom e toque nos cards para ler os detalhes.</div>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={dismissFlowNavTip} className="px-2 py-1 rounded-md border border-slate-600 text-slate-200 text-[11px]">Fechar</button>
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-slate-700" />
            </div>
          )}
          <Button id="btn-save-pdf"
            variant="outline" 
            size="md"
            className="!bg-white !text-slate-800 hover:!bg-slate-50 !border-slate-200/50 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 ring-1 ring-slate-200/50 w-full sm:w-auto" 
            onClick={exportPdf} 
            disabled={!proposal}
          >
            <FontAwesomeIcon icon={solidIcons.faDownload} className="mr-1 sm:mr-2" size="sm" />
            <span className="truncate">
              <span className="sm:hidden">Salvar PDF</span>
              <span className="hidden sm:inline">{t('studio.savePDF')}</span>
            </span>
          </Button>
          </div>
        )}
      </div>

      {/* Scheduling Modal */}
      <SchedulingModal
        isOpen={isSchedulingModalOpen}
        onClose={() => setIsSchedulingModalOpen(false)}
        onSchedule={handleScheduleConsultation}
        initialName={(localStorage.getItem('lead_name') || localStorage.getItem('user_name') || '') as string}
        initialEmail={(localStorage.getItem('lead_email') || localStorage.getItem('user_email') || '') as string}
        initialPhone={(localStorage.getItem('lead_phone') || localStorage.getItem('user_phone') || '') as string}
      />
    </div>
  );
};

export default ProjectStudio;