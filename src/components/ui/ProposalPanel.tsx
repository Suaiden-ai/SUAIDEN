import React from 'react';
import Button from './Button';
import { X, RefreshCw, Download, Copy, ArrowRight } from 'lucide-react';
import type { GeneratedProposal } from '../../services/ai';

interface ProposalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: GeneratedProposal | null;
  isGenerating: boolean;
  onRefine: (hint: string) => void;
  onContinue: () => void;
  onCopyMarkdown?: () => void;
}

const ProposalPanel: React.FC<ProposalPanelProps> = ({
  isOpen,
  onClose,
  proposal,
  isGenerating,
  onRefine,
  onContinue,
  onCopyMarkdown
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-dark-950/90 backdrop-blur-sm flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-900/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-r from-primary-500 to-accent-500" />
          <h3 className="text-lg font-medium">Proposta gerada por IA</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onRefine('Torne a proposta mais objetiva')}>
            <RefreshCw size={14} className="mr-2" /> Refine
          </Button>
          <Button variant="outline" size="sm" onClick={onCopyMarkdown}>
            <Copy size={14} className="mr-2" /> Copiar Markdown
          </Button>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-dark-800 text-white/70" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {isGenerating && (
            <div className="py-20 text-center">
              <div className="mx-auto w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              <p className="mt-4 text-white/70">Gerando proposta com IA...</p>
            </div>
          )}

          {!isGenerating && proposal && (
            <>
              <h1 className="text-2xl font-semibold">{proposal.title}</h1>
              <p className="text-white/80 mt-2">{proposal.summary}</p>

              <div className="grid md:grid-cols-2 gap-4 mt-6">
                {proposal.sections.map((s, idx) => (
                  <div key={idx} className="bg-dark-900/70 border border-dark-700 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="font-medium">{s.heading}</h2>
                      <button
                        onClick={() => onRefine(`Refine somente a seção "${s.heading}"`)}
                        className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                      >
                        <RefreshCw size={12} /> Refine
                      </button>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-white/80">
                      {s.content.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="bg-dark-900/70 border border-dark-700 rounded-xl p-5 mt-6">
                <h2 className="font-medium mb-2">Cronograma</h2>
                <ul className="space-y-1 text-white/80">
                  {proposal.timeline.map((t, i) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className="text-white/60 w-48 min-w-48">{t.phase}</span>
                      <span>{t.duration} — {t.details}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-white/70 text-sm mt-3">{proposal.budgetNote}</p>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-dark-700 bg-dark-900/80">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="md" onClick={() => onRefine('Ajuste o escopo para um MVP de 2 semanas')}>
              <RefreshCw size={16} className="mr-2" /> Focar em MVP
            </Button>
            <Button variant="outline" size="md" onClick={() => onRefine('Considere integrações com CRM e planilhas')}>
              <RefreshCw size={16} className="mr-2" /> Integrar sistemas
            </Button>
            <Button variant="outline" size="md" onClick={() => onRefine('Reduza custos de inferência e detalhe otimizações')}>
              <RefreshCw size={16} className="mr-2" /> Otimizar custos
            </Button>
          </div>
          <Button size="lg" onClick={onContinue} className="group">
            Continuar para contato
            <ArrowRight size={18} className="ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ProposalPanel;


