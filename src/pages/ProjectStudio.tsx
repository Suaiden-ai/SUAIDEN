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
import * as htmlToImage from 'html-to-image';

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
const ThinkingIndicator: React.FC = () => (
  <div className="flex items-center gap-2 text-gray-400">
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
    <span className="text-sm">Thinking...</span>
  </div>
);

// ANOTAÇÃO: Componente dedicado para renderizar o conteúdo da mensagem do assistente.
// Isso torna o componente principal muito mais limpo e a lógica de renderização mais fácil de gerenciar.
const AssistantMessage: React.FC<{ content: string }> = ({ content }) => {
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
        if (line.includes('Cronograma sugerido:') || line.includes('Cronograma atualizado:') || line.includes('Proposta atualizada')) {
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
  const params = useHashQuery();
  const flowRef = useRef<FlowCanvasHandle>(null);
  const initialDesc = useMemo(() => params.get('desc') ? decodeURIComponent(params.get('desc') as string) : '', [params]);
  const sessionId = useRef<string>('');
  
  if (!sessionId.current) {
    const existing = sessionStorage.getItem('studioSessionId');
    if (existing) {
      sessionId.current = existing;
    } else {
      const id = crypto.randomUUID();
      sessionStorage.setItem('studioSessionId', id);
      sessionId.current = id;
    }
  }

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(
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
          const projectSummary = `\n\nResumo do Projeto:\n${aiProposal.summary}`;
          setMessages(prev => [...prev, { role: 'assistant', content: `Cronograma sugerido:\n${timelineText}${projectSummary}` }]);
        } else {
          console.log('❌ IA retornou null - sem proposta gerada');
          setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Cota da API excedida. Você já usou as 50 requisições gratuitas do dia. Aguarde 24h ou configure billing no Google Cloud Console.' }]);
        }
      } catch (error) {
        console.error('❌ Erro na geração com IA:', error);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Erro: Falha na comunicação com a IA. Verifique sua conexão e configurações.' }]);
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

  const send = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    const newMessages = [...messages, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: 'Thinking...' }];
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
        const projectSummary = `\n\nResumo do Projeto:\n${aiProposal.summary}`;
            return [...withoutThinking, { role: 'assistant', content: `Cronograma atualizado:\n${timelineText}${projectSummary}` }];
      } else {
        console.log('❌ IA retornou null - sem atualização');
            return [...withoutThinking, { role: 'assistant', content: 'Erro: Não foi possível atualizar a proposta. Verifique a configuração da IA.' }];
          }
        });
    } catch (error) {
      console.error('❌ Erro na atualização com IA:', error);
      setMessages(prev => {
        const withoutThinking = prev.slice(0, -1);
        return [...withoutThinking, { role: 'assistant', content: 'Erro: Falha na comunicação com a IA. Verifique sua conexão e configurações.' }];
      });
    } finally {
      setLoading(false);
    }
  }, [input, messages, initialDesc, buildDescriptionFromHistory]);

  // ANOTAÇÃO: useMemo para evitar recalcular o fluxo em cada renderização, a menos que a proposta mude.
  const flowData = useMemo(() => {
    if (!proposal) return null;

    const baseX = 220, stepX = 420, baseY = 220, stepY = 180, maxRowsPerColumn = 4;
    const colors: NodeData['color'][] = ['lime','sky','accent','primary','slate'];
    const nodes: NodeData[] = [{ id: 'input', title: 'Input', subtitleLines: [proposal.summary], color: 'lime', x: baseX, y: baseY }];
    const edges: Array<{ from: string; to: string }> = [];

    let col = 1, row = 0, lastNodeId = 'input', totalNodesInCurrentColumn = 0;
    
    proposal.sections.forEach((s, idx) => {
      const contentChunks = splitContentIntoNodes(s.content);
      contentChunks.forEach((chunk, chunkIdx) => {
        const nodeId = `sec-${idx}-${chunkIdx}`;
      const x = baseX + col * stepX;
      const y = baseY + row * stepY - 60;
        const title = chunkIdx === 0 ? s.heading : `${s.heading} (${chunkIdx + 1})`;
        
        nodes.push({ id: nodeId, title, subtitleLines: chunk, color: colors[idx % colors.length], x, y });
        edges.push({ from: lastNodeId, to: nodeId });
        lastNodeId = nodeId;
      row++;
        totalNodesInCurrentColumn++;
        
        if (row >= maxRowsPerColumn) { 
          row = 0; 
          col++; 
          totalNodesInCurrentColumn = 0;
        }
      });
    });
    
    const outputX = baseX + (col + 1) * stepX;
    const outputY = baseY + Math.max(0, (totalNodesInCurrentColumn - 1) * stepY / 2);
    
    nodes.push({ id: 'output', title: 'Output', subtitleLines: ['Resumo e próximos passos'], color: 'accent', x: outputX, y: outputY });
    edges.push({ from: lastNodeId, to: 'output' });
    
    const totalColumns = col + 2;
    const maxNodesInColumn = Math.max(...Array.from({length: totalColumns}, (_, i) => {
      if (i === 0 || i === totalColumns - 1) return 1;
      return Math.ceil(proposal.sections.length / (totalColumns - 2));
    }));
    
    const h = Math.max(650, maxNodesInColumn * stepY + 400);
    return { nodes, edges, height: h };
  }, [proposal]);

  // ANOTAÇÃO: useCallback para memoizar a função e evitar recriações desnecessárias.
  const exportPdf = useCallback(async () => {
    if (!proposal) return;
    
             const originalConsoleError = console.error;
    // ANOTAÇÃO: Suprimir um erro específico e conhecido da biblioteca de imagem.
    // Isso pode ser arriscado, pois pode ocultar outros erros. Use com cautela.
             console.error = (...args) => {
      if (args[0]?.includes?.('removeChild') || args[0]?.includes?.('NotFoundError')) return;
               originalConsoleError.apply(console, args);
             };
             
             try {
               const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      // ... (O conteúdo da função de PDF permanece o mesmo, pois é bem procedural)
      // O código original para gerar o PDF está correto e foi mantido aqui.
               const margin = 32;
               let y = margin;

               doc.setFont('helvetica', 'bold');
               doc.setFontSize(24);
      doc.setTextColor(139, 92, 246);
               doc.text('SUAIDEN AI', margin, y);
               y += 30;

               doc.setFont('helvetica', 'normal');
               doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text('Relatório gerado pela SUAIDEN AI', margin, y);
               y += 25;

               doc.setDrawColor(200, 200, 200);
               doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
               y += 20;

      if (proposal.summary) {
        doc.setTextColor(0, 0, 0);
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(16);
                 doc.text('Resumo do Projeto', margin, y);
                 y += 20;
                 const summaryHeight = 60;
                 doc.setFillColor(248, 250, 252);
                 doc.roundedRect(margin, y - 5, doc.internal.pageSize.getWidth() - margin * 2, summaryHeight, 5, 5, 'F');
                 doc.setFont('helvetica', 'normal');
                 doc.setFontSize(12);
                 doc.setTextColor(50, 50, 50);
                 const summary = doc.splitTextToSize(proposal.summary, 520);
                 doc.text(summary, margin + 10, y + 15);
                 y += summaryHeight + 15;
               }

      if (proposal.timeline?.length) {
                 if (y > doc.internal.pageSize.getHeight() - 150) {
                   doc.addPage();
                   y = margin;
                 }
                 doc.setTextColor(0, 0, 0);
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(16);
                 doc.text('Cronograma Sugerido', margin, y);
                 y += 20;
                 doc.setFont('helvetica', 'normal');
                 doc.setFontSize(11);
                 proposal.timeline.forEach((t, index) => {
                   if (y > doc.internal.pageSize.getHeight() - 80) {
                     doc.addPage();
                     y = margin;
                   }
                   const itemHeight = 35;
                   doc.setFillColor(240, 248, 255);
                   doc.roundedRect(margin, y - 5, doc.internal.pageSize.getWidth() - margin * 2, itemHeight, 3, 3, 'F');
                   doc.setFillColor(139, 92, 246);
                   doc.circle(margin + 15, y + 8, 8, 'F');
                   doc.setTextColor(255, 255, 255);
                   doc.setFont('helvetica', 'bold');
                   doc.setFontSize(10);
                   doc.text(String(index + 1), margin + 15, y + 12);
                   doc.setTextColor(0, 0, 0);
                   doc.setFont('helvetica', 'bold');
                   doc.setFontSize(11);
                   doc.text(t.phase, margin + 35, y + 8);
                   doc.setFont('helvetica', 'normal');
                   doc.setFontSize(10);
                   doc.setTextColor(100, 100, 100);
                   doc.text(t.duration, margin + 35, y + 18);
                   const details = doc.splitTextToSize(t.details, 480);
                   doc.setTextColor(50, 50, 50);
                   doc.text(details, margin + 35, y + 28);
                   y += itemHeight + 10;
                 });
                 y += 10;
               }

               const flowContainer = document.getElementById('flow-canvas-container');
               if (flowContainer) {
        if (y > doc.internal.pageSize.getHeight() - 300) { doc.addPage(); y = margin; }
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(13);
                 doc.text('Fluxo Proposto', margin, y);
                 y += 16;
                 
        try {
          const dataUrl = await htmlToImage.toPng(flowContainer, { backgroundColor: '#f1f5f9', pixelRatio: 1, quality: 0.8, skipFonts: true, cacheBust: true });
                   const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
                   const imgProps = (doc as any).getImageProperties(dataUrl);
          const imgHeight = (imgProps.height * pageWidth) / imgProps.width;
                   const maxHeight = Math.min(500, doc.internal.pageSize.getHeight() - y - margin - 50);
                   const finalHeight = Math.min(imgHeight, maxHeight);
                   const finalWidth = (imgProps.width * finalHeight) / imgProps.height;
                   const xOffset = margin + (pageWidth - finalWidth) / 2;
          if (y + finalHeight > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
                   doc.addImage(dataUrl, 'PNG', xOffset, y, finalWidth, finalHeight);
                   y += finalHeight + 20;
        } catch (imgError) {
            console.error("Erro ao converter fluxo para imagem:", imgError)
        }
      }

      if (proposal.sections?.length) {
                 doc.addPage();
                 y = margin;
                 doc.setTextColor(0, 0, 0);
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(16);
                 doc.text('Textos do Fluxo', margin, y);
                 y += 25;
                 doc.setFont('helvetica', 'normal');
                 doc.setFontSize(11);
                 proposal.sections.forEach((s) => {
          if (y > doc.internal.pageSize.getHeight() - 100) { doc.addPage(); y = margin; }
                   const sectionHeight = 25;
                   doc.setFillColor(139, 92, 246);
                   doc.roundedRect(margin, y - 5, doc.internal.pageSize.getWidth() - margin * 2, sectionHeight, 3, 3, 'F');
                   doc.setTextColor(255, 255, 255);
                   doc.setFont('helvetica', 'bold');
                   doc.setFontSize(12);
                   doc.text(s.heading, margin + 10, y + 10);
                   y += sectionHeight + 10;
                   doc.setTextColor(0, 0, 0);
                   doc.setFont('helvetica', 'normal');
                   doc.setFontSize(10);
                   s.content.forEach((c) => {
            if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = margin; }
                     doc.setFillColor(139, 92, 246);
                     doc.circle(margin + 8, y + 4, 2, 'F');
                     const wrapped = doc.splitTextToSize(c, 500);
                     doc.text(wrapped, margin + 20, y + 6);
                     y += wrapped.length * 12 + 8;
                   });
                   y += 15;
                 });
               }

      doc.save('relatorio-suaiden-ai.pdf');
             } catch (error) {
               console.error('Erro ao gerar PDF:', error);
             } finally {
               console.error = originalConsoleError;
             }
  }, [proposal]);

  const handleScheduleConsultation = useCallback((data: any) => {
    console.log('Agendamento solicitado:', data);
    // Feedback inline é exibido dentro do próprio modal; nada a fazer aqui.
  }, []);

  return (
    <div className={`min-h-screen md:grid md:grid-cols-1 ${isChatHidden ? 'md:grid-cols-1' : 'md:grid-cols-[420px_1fr]'} bg-slate-900`}>
      {/* Left: Chat */}
      <div className={`border-r border-slate-700 max-h-screen h-screen ${mobileView === 'flow' ? 'hidden md:flex' : 'flex md:flex'} ${isChatHidden ? 'md:hidden' : ''} flex-col relative chat-container`}>
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900 chat-header">
          <button onClick={() => window.location.hash = ''} className="flex items-center gap-2 text-white hover:text-primary-400 transition-colors">
            <FontAwesomeIcon icon={solidIcons.faArrowRight} size="sm" className="rotate-180" />
            <span className="font-medium text-sm">Voltar para Página inicial</span>
          </button>
          <div className="md:hidden relative z-20">
            <button onClick={() => setMobileView('flow')} disabled={!proposal} className={`text-xs px-3 py-2 rounded-lg border transition-colors relative z-20 ${proposal ? 'text-white border-slate-600 hover:bg-slate-800' : 'text-slate-500 border-slate-800 opacity-60'}`}>
              Visualizar fluxo
            </button>
          </div>
        </div>
        
        {/* Chat Close Button - Outside the chat, on the right edge */}
        {!isChatHidden && (
          <button 
            type="button" 
            aria-label="Esconder chat" 
            title="Esconder chat" 
            onClick={() => setIsChatHidden(true)} 
            className={`hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-14 rounded-r-2xl rounded-l-md bg-slate-900 backdrop-blur border border-slate-700 shadow-xl hover:bg-slate-800 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 z-10 ${edgeHintPulse ? 'animate-pulse' : ''}`}
          >
            <FontAwesomeIcon icon={solidIcons.faChevronLeft} size="sm" />
          </button>
        )}
        
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`${m.role === 'user' ? 'ml-12' : ''}`}>
              <div className={`px-4 py-3 whitespace-pre-line text-sm leading-relaxed ${m.role === 'user' ? 'bg-slate-700 text-white rounded-xl border border-slate-600' : 'text-white/90 w-full'}`}>
                {m.role === 'assistant' ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-purple-500 p-0.5 rounded"><FontAwesomeIcon icon={solidIcons.faBrain} size="sm" className="text-white" /></div>
                      <span className="font-semibold text-violet-400 text-sm">Suaiden AI</span>
                    </div>
                    <div className="leading-relaxed text-gray-200">
                        {m.content === 'Thinking...' ? <ThinkingIndicator /> : <AssistantMessage content={m.content} />}
                    </div>
                    {m.content !== 'Thinking...' && (
                       <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <button className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${aiFeedback[i] === 'up' ? 'text-primary-400' : ''}`} aria-label="Gostei" onClick={() => setAiFeedback(prev => ({ ...prev, [i]: prev[i] === 'up' ? undefined : 'up' }))}><FontAwesomeIcon icon={solidIcons.faThumbsUp} size="sm" /></button>
                        <button className={`p-1.5 rounded-md hover:bg-slate-800 transition-colors ${aiFeedback[i] === 'down' ? 'text-primary-400' : ''}`} aria-label="Não gostei" onClick={() => setAiFeedback(prev => ({ ...prev, [i]: prev[i] === 'down' ? undefined : 'down' }))}><FontAwesomeIcon icon={solidIcons.faThumbsDown} size="sm" /></button>
                        <button className="p-1.5 rounded-md hover:bg-slate-800 transition-colors" aria-label="Copiar resposta" onClick={() => navigator.clipboard.writeText(m.content).catch(() => {})}><FontAwesomeIcon icon={solidIcons.faCopy} size="sm" /></button>
                        
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-white font-medium">{m.content}</div>
                )}
              </div>
            </div>
          ))}
          {messages.length === 0 && <div className="text-slate-500 text-xs text-center mt-8">Comece descrevendo seu projeto</div>}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex-shrink-0 p-6 bg-slate-900 border-t border-slate-700 chat-input relative z-30">
          <ChatInput value={input} onChange={setInput} onSend={send} loading={loading} placeholder="Ask Suaiden..." />
        </div>
        
      </div>
      
      {/* Right: Flow + Proposal */}
      <div className={`h-screen relative ${mobileView === 'chat' ? 'hidden md:flex' : 'flex md:flex'} flex-col flow-container`}>
        <div className="flex-none px-4 pt-4 pb-2 relative z-20 flow-header">
          <div className="w-full flex items-center justify-between">
            <span className="text-white/90 font-medium">Fluxo Proposto</span>
            <button className="md:hidden text-xs px-3 py-2 rounded-lg border border-slate-600 text-white hover:bg-slate-800 transition-colors relative z-40" onClick={() => setMobileView('chat')}>
              Voltar para chat
            </button>
          </div>
        </div>
        
        <div id="flow-canvas-container" className="flex-1 flex flex-col min-h-0 overflow-auto rounded-2xl flow-canvas">
          {flowData && <FlowCanvas ref={flowRef} nodes={flowData.nodes} edges={flowData.edges} height={flowData.height} />}
        </div>
        
        {isChatHidden && (
          <button type="button" aria-label="Mostrar chat" title="Mostrar chat" onClick={() => setIsChatHidden(false)} className={`hidden md:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 w-6 h-14 rounded-l-2xl rounded-r-md bg-primary-600/95 backdrop-blur border border-primary-500 shadow-xl hover:bg-primary-500 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${edgeHintPulse ? 'animate-pulse' : ''}`}>
            <FontAwesomeIcon icon={solidIcons.faChevronRight} size="sm" />
          </button>
        )}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20 flex gap-3">
          <Button className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm shadow-lg" onClick={() => setIsSchedulingModalOpen(true)}>
            Solicitar Consultoria
          </Button>
          <Button className="bg-accent-700 text-white px-4 py-2 rounded-lg text-sm shadow-lg" onClick={exportPdf} disabled={!proposal}>
            Salvar PDF
          </Button>
         </div>
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