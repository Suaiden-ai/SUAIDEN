import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Loader2, CalendarClock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../jobs/ui/dialog';
import { Button } from '../jobs/ui/button';
import { Input } from '../jobs/ui/input';
import { Label } from '../jobs/ui/label';
import { Textarea } from '../jobs/ui/textarea';
import type { FinanceItem } from './FinanceItemModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item: FinanceItem | null;
}

// primeiro dia do mês corrente em YYYY-MM
const currentMonth = () => new Date().toISOString().slice(0, 7);

const fmtUSD = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// mês seguinte (YYYY-MM) ao informado
const nextMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1); // m (1-based) => próximo mês em base 0
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const FinanceEntryModal: React.FC<Props> = ({ open, onClose, onSaved, item }) => {
  const [month, setMonth] = useState(currentMonth());
  const [amount, setAmount] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Devs quinzenais: o valor informado é o MENSAL, dividido em 2 parcelas.
  const isBiweekly = item?.recurrence === 'biweekly';
  const monthly = Number(amount) || 0;
  const half = monthly / 2;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMonth(currentMonth());
    setAmount(item ? String(item.base_amount ?? '') : '');
    setFlagged(false);
    setNotes('');
  }, [open, item]);

  const handleSave = async () => {
    setError(null);
    if (!item) return;
    if (!amount.trim() || Number.isNaN(Number(amount))) {
      setError('Informe um valor válido.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError('Informe a competência (mês).');
      return;
    }

    const competence = `${month}-01`;
    const baseRow = {
      item_id: item.id,
      category: item.category,
      name: item.name,
      competence,
      flagged,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (isBiweekly) {
        // 2 parcelas de metade: 1ª quinzena (dia 20) + 2ª quinzena (dia 05 do mês seguinte)
        const rows = [
          { ...baseRow, amount: half, period: 'first_half', pay_day: 20 },
          { ...baseRow, amount: monthly - half, period: 'second_half', pay_day: 5 },
        ];
        const { error: err } = await supabase
          .from('finance_entries')
          .upsert(rows, { onConflict: 'item_id,competence,period' });
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('finance_entries')
          .upsert(
            { ...baseRow, amount: monthly, period: 'full' },
            { onConflict: 'item_id,competence,period' }
          );
        if (err) throw err;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erro ao lançar despesa:', err);
      setError(err?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#1d2125] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            Lançar despesa{item ? ` — ${item.name}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-month">Competência</Label>
              <Input
                id="entry-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-black/30 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-amount">{isBiweekly ? 'Valor mensal (USD)' : 'Valor (USD)'}</Label>
              <Input
                id="entry-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-black/30 border-white/10"
              />
            </div>
          </div>

          {/* Preview das parcelas quinzenais */}
          {isBiweekly && monthly > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-primary/80 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" /> Pagamento quinzenal
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">1ª quinzena · vence dia 20/{month.slice(5)}</span>
                <span className="font-bold text-white tabular-nums">{fmtUSD(half)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">2ª quinzena · vence dia 05/{nextMonth(month).slice(5)}</span>
                <span className="font-bold text-white tabular-nums">{fmtUSD(monthly - half)}</span>
              </div>
              <p className="text-[11px] text-white/40 pt-1 border-t border-white/5">
                Dia 20: dias 1–15 · Dia 05 (mês seguinte): dias 16–31 desta competência.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="entry-notes">Observações</Label>
            <Textarea
              id="entry-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="bg-black/30 border-white/10 min-h-[60px]"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => setFlagged(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-sm text-white/80">Marcar como atípico (a verificar)</span>
          </label>

          <p className="text-xs text-white/40">
            {isBiweekly
              ? 'As parcelas desta competência serão substituídas se já existirem.'
              : 'Se já houver lançamento neste mês para o item, ele será substituído.'}
          </p>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinanceEntryModal;
