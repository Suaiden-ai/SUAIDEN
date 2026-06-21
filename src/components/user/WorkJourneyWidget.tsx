import React, { useEffect, useState } from 'react';
import { Play, Square, Loader2, Pause, Clock } from 'lucide-react';
import { useWorkJourney } from '../../hooks/jobs/useWorkJourney';
import { formatHMS } from '../../lib/workJourney';
import WorkReportModal from './WorkReportModal';

interface WorkJourneyWidgetProps {
  userId: string;
}

const WorkJourneyWidget: React.FC<WorkJourneyWidgetProps> = ({ userId }) => {
  const { loading, status, activeSession, reportRequired, checkIn, checkOut, submitReport } =
    useWorkJourney(userId);

  const [busy, setBusy] = useState(false);
  // Modal aberto manualmente pelo usuário (além da abertura automática obrigatória).
  const [manualOpen, setManualOpen] = useState(false);

  // Abre automaticamente quando o relatório é obrigatório.
  const modalOpen = reportRequired || manualOpen;
  const mandatory = reportRequired;
  const paused = status.state === 'paused';

  // Ao deixar de ser obrigatório (relatório enviado), garante que o manual fecha.
  useEffect(() => {
    if (!reportRequired) setManualOpen(false);
  }, [reportRequired]);

  const handleCheckIn = async () => {
    setBusy(true);
    try {
      await checkIn();
    } catch {
      /* logado no hook */
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setBusy(true);
    try {
      await checkOut();
    } catch {
      /* logado no hook */
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
  }

  // Sem jornada ativa → botão de iniciar.
  if (!activeSession) {
    return (
      <button
        onClick={handleCheckIn}
        disabled={busy}
        className="flex items-center gap-2 h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50"
        title="Iniciar jornada de trabalho"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">Iniciar jornada</span>
      </button>
    );
  }

  // Jornada ativa → cronômetro + status + encerrar.
  const statusConfig = paused
    ? { dot: 'bg-red-500 animate-pulse', label: 'Pausado', text: 'text-red-400', Icon: Pause }
    : status.state === 'running_pending_report'
      ? { dot: 'bg-amber-400 animate-pulse', label: 'Relatório pendente', text: 'text-amber-400', Icon: Clock }
      : { dot: 'bg-emerald-400', label: 'Trabalhando', text: 'text-emerald-400', Icon: Clock };

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Cronômetro + status (abre o modal ao clicar) */}
        <button
          onClick={() => setManualOpen(true)}
          className="flex items-center gap-2 h-8 px-3 rounded-xl bg-black/30 border border-white/10 hover:border-primary/30 transition-all"
          title="Enviar relatório de progresso"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.dot}`} />
          <span className="font-mono text-xs font-bold text-white tabular-nums">
            {formatHMS(status.validSeconds)}
          </span>
          <span className={`hidden md:inline text-[10px] font-bold uppercase tracking-wide ${statusConfig.text}`}>
            {statusConfig.label}
          </span>
        </button>

        {/* Encerrar jornada */}
        <button
          onClick={handleCheckOut}
          disabled={busy}
          className="flex items-center justify-center h-8 w-8 rounded-xl bg-white/5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive border border-white/10 transition-all disabled:opacity-50"
          title="Encerrar jornada"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
        </button>
      </div>

      <WorkReportModal
        open={modalOpen}
        mandatory={mandatory}
        paused={paused}
        onSubmit={submitReport}
        onCheckOut={handleCheckOut}
        onClose={() => setManualOpen(false)}
      />
    </>
  );
};

export default WorkJourneyWidget;
