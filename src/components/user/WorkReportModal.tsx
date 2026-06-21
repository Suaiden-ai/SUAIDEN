import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, LogOut, Clock } from 'lucide-react';

interface WorkReportModalProps {
  open: boolean;
  /** Se true, o modal é obrigatório: não fecha sem enviar (relatório pendente/pausado). */
  mandatory: boolean;
  paused: boolean;
  onSubmit: (content: string) => Promise<void>;
  onCheckOut: () => Promise<void>;
  /** Só permitido quando !mandatory. */
  onClose: () => void;
}

const WorkReportModal: React.FC<WorkReportModalProps> = ({
  open,
  mandatory,
  paused,
  onSubmit,
  onCheckOut,
  onClose,
}) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [endingShift, setEndingShift] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
      if (!mandatory) onClose();
    } catch {
      /* erro logado no hook */
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (endingShift) return;
    setEndingShift(true);
    try {
      await onCheckOut();
      setContent('');
    } finally {
      setEndingShift(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => {
            if (!mandatory) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[#0c0c0c] border border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className={`px-6 py-5 border-b border-white/5 ${paused ? 'bg-red-500/10' : 'bg-primary/10'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paused ? 'bg-red-500/20' : 'bg-primary/20'}`}>
                  <Clock className={`w-5 h-5 ${paused ? 'text-red-400' : 'text-primary'}`} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Relatório de progresso</h2>
                  <p className="text-xs text-muted-foreground">
                    {paused
                      ? 'Sua jornada está pausada. Envie o relatório para retomar a contagem.'
                      : 'Conte rapidamente o que você está fazendo ou acabou de fazer.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="Ex.: Implementando a tela de login e ajustando validações do formulário..."
                className="w-full rounded-xl bg-black/30 border border-white/10 focus:border-primary/50 px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none resize-none"
              />

              <div className="flex items-center justify-between gap-3">
                {mandatory ? (
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={endingShift}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white hover:bg-destructive/10 transition-all disabled:opacity-50"
                  >
                    {endingShift ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    Encerrar jornada
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                  >
                    Agora não
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!content.trim() || submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar relatório
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default WorkReportModal;
