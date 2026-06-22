import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Badge } from '../../components/jobs/ui/badge';
import { Progress } from '../../components/jobs/ui/progress';
import { Loader2, Play, Square, Send, Clock, Pause } from 'lucide-react';
import { useWorkJourney } from '../../hooks/jobs/useWorkJourney';
import { formatHMS } from '../../lib/workJourney';

const MyJourney: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
      setAuthLoading(false);
    });
  }, []);

  const { loading, status, activeSession, reportRequired, checkIn, checkOut, submitReport } =
    useWorkJourney(userId);

  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const paused = status.state === 'paused';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* logado no hook */
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await run(() => submitReport(content.trim()));
    setContent('');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const statusConfig = paused
    ? { label: 'Pausado', cls: 'text-red-400 border-red-500/30 bg-red-500/10', Icon: Pause }
    : status.state === 'running_pending_report'
    ? { label: 'Relatório pendente', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10', Icon: Clock }
    : status.state === 'running'
    ? { label: 'Trabalhando', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', Icon: Play }
    : { label: 'Offline', cls: 'text-white/40 border-white/10 bg-white/5', Icon: Clock };

  return (
    <div className="space-y-10 max-w-2xl">
      {/* Header */}
      <div className="space-y-4 pb-8 border-b border-white/5">
        <Badge
          variant="tech"
          className="px-4 py-1.5 bg-primary/20 border-primary/40 text-primary font-black uppercase tracking-widest text-[10px]"
        >
          Controle de Jornada
        </Badge>
        <h1 className="text-5xl font-black tracking-tight text-white italic">Minha Jornada</h1>
        <p className="text-muted-foreground text-xl">
          Faça check-in para começar a contar seu tempo de trabalho.
        </p>
      </div>

      {/* Cartão principal */}
      <div className="rounded-2xl border border-white/5 bg-[#1d2125] p-8 space-y-6">
        {/* Status + cronômetro */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold ${statusConfig.cls}`}>
              <statusConfig.Icon className="w-4 h-4" />
              {statusConfig.label}
            </div>
            <p className="font-mono text-4xl font-black text-white tabular-nums mt-3">
              {formatHMS(status.validSeconds)}
            </p>
          </div>

          {!activeSession ? (
            <button
              onClick={() => run(checkIn)}
              disabled={busy}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              Iniciar jornada
            </button>
          ) : (
            <button
              onClick={() => run(checkOut)}
              disabled={busy}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive border border-white/10 font-bold transition-all disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />}
              Encerrar jornada
            </button>
          )}
        </div>

        {/* Relatório */}
        {activeSession && (
          <div className="pt-6 border-t border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Relatório de progresso</h3>
              {reportRequired && (
                <span className="text-[11px] font-bold text-amber-400">
                  {paused ? 'Jornada pausada — envie para retomar' : 'Relatório pendente'}
                </span>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="O que você está fazendo agora?"
              className="w-full rounded-xl bg-black/30 border border-white/10 focus:border-primary/50 px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none resize-none"
            />
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || busy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar relatório
            </button>
          </div>
        )}

        {paused && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300/90 text-xs">
            <Pause className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Sua jornada está pausada porque o relatório não foi enviado a tempo. O tempo só volta a contar após o envio.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyJourney;
