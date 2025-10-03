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

// ANOTAÇÃO: Funções puras movidas para fora do componente para evitar recriação em cada renderização.
function calculateOptimalItemsPerNode(content: string[]): number {
  const avgLength = content.reduce((sum, item) => sum + item.length, 0) / content.length;
  if (avgLength > 300) return 1;
  if (avgLength > 150) return 2;
  return 3;
}

function splitContentIntoNodes(content: string[], maxItemsPerNode?: number): string[][] {
  const optimalItems = maxItemsPerNode || calculateOptimalItemsPerNode(content);
  const result: string[][] = [];
  let currentChunk: string[] = [];
  
  for (const item of content) {
    if (item.length > 200) {
      if (currentChunk.length > 0) {
        result.push([...currentChunk]);
        currentChunk = [];
      }
      const sentences = item.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const chunks = [];
      let currentSentence = '';
      for (const sentence of sentences) {
        if ((currentSentence + sentence).length > 120) {
          if (currentSentence.trim()) chunks.push(currentSentence.trim());
          currentSentence = sentence.trim();
        } else {
          currentSentence += (currentSentence ? '. ' : '') + sentence.trim();
        }
      }
      if (currentSentence.trim()) chunks.push(currentSentence.trim());
      chunks.forEach(chunk => result.push([chunk]));
    } else {
      currentChunk.push(item);
      if (currentChunk.length >= optimalItems) {
        result.push([...currentChunk]);
        currentChunk = [];
      }
    }
  }
  
  if (currentChunk.length > 0) {
    result.push(currentChunk);
  }
  
  return result;
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

// ANOTAÇÃO: Componente dedicado para renderizar o conteúdo da mensagem do assistente.
// Isso torna o componente principal muito mais limpo e a lógica de renderização mais fácil de gerenciar.
const AssistantMessage: React.FC<{ content: string; t: (key: string) => string }> = ({ content, t }) => {
  return (
    <div className="space-y-3">
      {content.split('\n').map((line, idx) => {
        const normalized = line.replace(/[–—]/g, '—');
        const hasSeparator = normalized.includes('—');
        const hasDuration = /(week|weeks|day|days|hour|hours|semana|semanas|dia|dias|mês|meses|hora|horas|Contínuo|Continuo|Ongoing)/i.test(normalized);

        if (hasSeparator && hasDuration) {
          const [phase, duration, ...details] = normalized.split('—');
          return (
            <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border-l-4 border-violet-500">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-2 h-2 bg-violet-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="font-semibold text-violet-300 text-sm mb-1">{phase.trim()}</div>
                  <div className="text-xs text-gray-400 mb-2 font-medium">{duration.trim()}</div>
                  <div className="text-gray-200 text-sm">{details.join('—').trim()}</div>
                </div>
              </div>
            </div>
          );
        }
        if (line.includes(t('studio.suggestedSchedule') + ':') || line.includes(t('studio.scheduleUpdated') + ':') || line.includes(t('studio.proposalUpdated'))) {
          return <div key={idx} className="font-bold text-white text-base mb-4">{line}</div>;
        }
        if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().startsWith('–')) {
          return (
            <div key={idx} className="flex items-start gap-2 text-gray-200 leading-relaxed">
              <span className="text-violet-500 mt-1">•</span>
              <span>{line.trim().substring(1).trim()}</span>
            </div>
          );
        }
        if (line.includes('Benefícios:') || line.includes('Funcionalidades:') || line.includes('Tecnologias:') || line.includes('Cronograma:') || line.includes('Orçamento:')) {
            return <div key={idx} className="font-semibold text-violet-400 text-sm mb-2 mt-4">{line}</div>;
        }
        if (line.includes('Resumo:') || line.includes('Resumo do Projeto:') || line.includes('Visão Geral:')) {
            return <div key={idx} className="font-semibold text-violet-400 text-sm mb-2 mt-4">{line}</div>;
        }
        if (line.includes('**') && line.split('**').length >= 3) {
          const parts = line.split('**');
          return (
            <div key={idx} className="text-gray-200 leading-relaxed">
              {parts.map((part, partIdx) => partIdx % 2 === 1 ? <strong key={partIdx} className="text-white font-semibold">{part}</strong> : <span key={partIdx}>{part}</span>)}
            </div>
          );
        }
        if (line.trim()) {
          return <div key={idx} className="text-gray-200 leading-relaxed">{line}</div>;
        }
        return null;
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
  console.log('🎨 ProjectStudio loaded with language:', language);
  
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
    const nodes: NodeData[] = [{ id: 'input', title: 'Input', subtitleLines: [proposal.summary], color: 'lime', x: baseX, y: baseY }];
    const edges: Array<{ from: string; to: string }> = [];

    let col = 0, row = 1, lastNodeId = 'input', totalNodesInCurrentColumn = 1; // col = 0 para começar na primeira coluna
    
    proposal.sections.forEach((s, idx) => {
      const contentChunks = splitContentIntoNodes(s.content);
      contentChunks.forEach((chunk, chunkIdx) => {
        const nodeId = `sec-${idx}-${chunkIdx}`;
        // No mobile, todos os nós ficam na mesma coluna (baseX)
        const x = isMobile ? baseX : baseX + col * stepX;
        const y = isMobile ? baseY + row * stepY : baseY + row * stepY;
        const title = chunkIdx === 0 ? s.heading : `${s.heading} (${chunkIdx + 1})`;
        
        nodes.push({ id: nodeId, title, subtitleLines: chunk, color: colors[idx % colors.length], x, y });
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
    });
    
    // Posicionamento do Output: na mesma coluna no mobile, última coluna no desktop
    const outputX = isMobile ? baseX : baseX + col * stepX;
    // No mobile, fica no final da pilha vertical
    const outputY = isMobile ? baseY + row * stepY : baseY + row * stepY;
    
    // Gerar conteúdo dinâmico para o nó Output
    const outputContent = [];
    
    // Adicionar resumo se disponível
    if (proposal.summary) {
      const summaryPreview = proposal.summary.length > 100 
        ? proposal.summary.substring(0, 100) + '...' 
        : proposal.summary;
      outputContent.push(`Resumo: ${summaryPreview}`);
    }
    
    // Adicionar informações do cronograma
    if (proposal.timeline && proposal.timeline.length > 0) {
      const totalDuration = proposal.timeline.reduce((acc, phase) => {
        const duration = phase.duration.match(/\d+/);
        return acc + (duration ? parseInt(duration[0]) : 0);
      }, 0);
      outputContent.push(`Cronograma: ${proposal.timeline.length} fases`);
      if (totalDuration > 0) {
        outputContent.push(`Duração estimada: ${totalDuration} dias`);
      }
    }
    
    // Adicionar informações das seções
    if (proposal.sections && proposal.sections.length > 0) {
      outputContent.push(`${proposal.sections.length} seções técnicas`);
    }
    
    // Adicionar próximos passos
    outputContent.push('Próximos passos: Implementação');
    
    nodes.push({ id: 'output', title: 'Output', subtitleLines: outputContent, color: 'accent', x: outputX, y: outputY });
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
          <div className="md:hidden relative z-20">
            <button onClick={() => setMobileView('flow')} disabled={!proposal} className={`text-xs px-3 py-2 rounded-lg border transition-colors relative z-20 ${proposal ? 'text-white border-slate-600 hover:bg-slate-800' : 'text-slate-500 border-slate-800 opacity-60'}`}>
              {t('studio.viewFlow')}
            </button>
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
                    <div className="leading-relaxed text-gray-200">
                        {m.content === t('studio.thinking') ? <ThinkingIndicator t={t} /> : (
                          <div>
                            {m.isStreaming ? (
                              <div className="space-y-3">
                                {m.content.split('\n').map((line, idx) => {
                                  const normalized = line.replace(/[–—]/g, '—');
                                  const hasSeparator = normalized.includes('—');
                                  const hasDuration = /(week|weeks|day|days|hour|hours|semana|semanas|dia|dias|mês|meses|hora|horas|Contínuo|Continuo|Ongoing)/i.test(normalized);

                                  if (hasSeparator && hasDuration) {
                                    const [phase, duration, ...details] = normalized.split('—');
                                    return (
                                      <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border-l-4 border-violet-500">
                                        <div className="flex items-start gap-3">
                                          <div className="flex-shrink-0 w-2 h-2 bg-violet-500 rounded-full mt-2"></div>
                                          <div className="flex-1">
                                            <div className="font-semibold text-violet-300 text-sm mb-1">{phase.trim()}</div>
                                            <div className="text-xs text-gray-400 mb-2 font-medium">{duration.trim()}</div>
                                            <div className="text-gray-200 text-sm">{details.join('—').trim()}</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  if (line.includes(t('studio.suggestedSchedule') + ':') || line.includes(t('studio.scheduleUpdated') + ':') || line.includes(t('studio.proposalUpdated'))) {
                                    return <div key={idx} className="font-bold text-white text-base mb-4">{line}</div>;
                                  }
                                  if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().startsWith('–')) {
                                    return (
                                      <div key={idx} className="flex items-start gap-2 text-gray-200 leading-relaxed">
                                        <span className="text-violet-500 mt-1">•</span>
                                        <span>{line.trim().substring(1).trim()}</span>
                                      </div>
                                    );
                                  }
                                  if (line.includes('Benefícios:') || line.includes('Funcionalidades:') || line.includes('Tecnologias:') || line.includes('Cronograma:') || line.includes('Orçamento:')) {
                                      return <div key={idx} className="font-semibold text-violet-400 text-sm mb-2 mt-4">{line}</div>;
                                  }
                                  if (line.includes('Resumo:') || line.includes('Resumo do Projeto:') || line.includes('Visão Geral:')) {
                                      return <div key={idx} className="font-semibold text-violet-400 text-sm mb-2 mt-4">{line}</div>;
                                  }
                                  if (line.includes('**') && line.split('**').length >= 3) {
                                    const parts = line.split('**');
                                    return (
                                      <div key={idx} className="text-gray-200 leading-relaxed">
                                        {parts.map((part, partIdx) => partIdx % 2 === 1 ? <strong key={partIdx} className="text-white font-semibold">{part}</strong> : <span key={partIdx}>{part}</span>)}
                                      </div>
                                    );
                                  }
                                  if (line.trim()) {
                                    return <div key={idx} className="text-gray-200 leading-relaxed">{line}</div>;
                                  }
                                  return null;
                                })}
                                <span className="inline-block w-2 h-4 bg-violet-400 ml-1 animate-pulse"></span>
                              </div>
                            ) : (
                              <AssistantMessage content={m.content} t={t} />
                            )}
                          </div>
                        )}
                    </div>
                    {m.content !== t('studio.thinking') && !m.isStreaming && (
                       <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <button className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${aiFeedback[i] === 'up' ? 'text-primary-400' : ''}`} aria-label={t('studio.like')} onClick={() => setAiFeedback(prev => ({ ...prev, [i]: prev[i] === 'up' ? undefined : 'up' }))}><FontAwesomeIcon icon={solidIcons.faThumbsUp} size="sm" /></button>
                        <button className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${aiFeedback[i] === 'down' ? 'text-primary-400' : ''}`} aria-label={t('studio.dislike')} onClick={() => setAiFeedback(prev => ({ ...prev, [i]: prev[i] === 'down' ? undefined : 'down' }))}><FontAwesomeIcon icon={solidIcons.faThumbsDown} size="sm" /></button>
                        <button className="p-1.5 rounded-md hover:bg-slate-800 transition-colors" aria-label={t('studio.copy')} onClick={() => navigator.clipboard.writeText(m.content).catch(() => {})}><FontAwesomeIcon icon={solidIcons.faCopy} size="sm" /></button>
                        
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
        
        <div className="flex-shrink-0 p-6 bg-zinc-900 border-t border-zinc-800 chat-input relative z-30">
          <ChatInput value={input} onChange={setInput} onSend={send} loading={loading} placeholder={t('studio.askSuaiden')} />
        </div>
        
      </div>
      
      {/* Right: Flow + Proposal */}
      <div className={`h-screen relative ${mobileView === 'chat' ? 'hidden md:flex' : 'flex md:flex'} flex-col flow-container bg-zinc-900`}>
        <div className="flex-none px-4 pt-4 pb-2 relative z-20 flow-header">
          <div className="w-full flex items-center justify-between">
            <span className="text-white/90 font-medium">{t('studio.proposedFlow')}</span>
            <button className="md:hidden text-xs px-3 py-2 rounded-lg border border-slate-600 text-white hover:bg-slate-800 transition-colors relative z-40" onClick={() => setMobileView('chat')}>
              {t('studio.backToChat')}
            </button>
          </div>
        </div>
        
        <div id="flow-canvas-container" className="flex-1 flex flex-col min-h-0 overflow-auto rounded-2xl flow-canvas">
          {flowData && <FlowCanvas ref={flowRef} nodes={flowData.nodes} edges={flowData.edges} height={flowData.height} />}
        </div>
        
        {isChatHidden && (
          <button type="button" aria-label={t('studio.showChat')} title={t('studio.showChat')} onClick={() => setIsChatHidden(false)} className={`hidden md:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 w-6 h-14 rounded-l-2xl rounded-r-md bg-primary-600/95 backdrop-blur border border-primary-500 shadow-xl hover:bg-primary-500 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${edgeHintPulse ? 'animate-pulse' : ''}`}>
            <FontAwesomeIcon icon={solidIcons.faChevronRight} size="sm" />
          </button>
        )}
        {!loading && (
          <div className="fixed bottom-4 left-2 right-2 sm:absolute sm:bottom-6 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:px-4 sm:w-auto max-w-[calc(100vw-1rem)] sm:max-w-none">
          <Button 
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
          <Button 
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