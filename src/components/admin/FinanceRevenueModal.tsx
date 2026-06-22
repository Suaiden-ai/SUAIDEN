import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Loader2 } from 'lucide-react';
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

export interface FinanceRevenue {
  id: string;
  source: string;
  description: string | null;
  competence: string; // YYYY-MM-DD
  amount: number;
  received: boolean;
  received_at: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  revenue?: FinanceRevenue | null;
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

const FinanceRevenueModal: React.FC<Props> = ({ open, onClose, onSaved, revenue }) => {
  const isEdit = !!revenue;
  const [source, setSource] = useState('');
  const [description, setDescription] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (revenue) {
      setSource(revenue.source);
      setDescription(revenue.description || '');
      setMonth(revenue.competence.slice(0, 7));
      setAmount(String(revenue.amount ?? ''));
      setReceived(revenue.received);
    } else {
      setSource('');
      setDescription('');
      setMonth(currentMonth());
      setAmount('');
      setReceived(false);
    }
  }, [open, revenue]);

  const handleSave = async () => {
    setError(null);
    if (!source.trim()) {
      setError('Informe a origem do recebimento.');
      return;
    }
    if (!amount.trim() || Number.isNaN(Number(amount))) {
      setError('Informe um valor válido.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError('Informe a competência (mês).');
      return;
    }

    const payload = {
      source: source.trim(),
      description: description.trim() || null,
      competence: `${month}-01`,
      amount: Number(amount),
      received,
      received_at: received ? new Date().toISOString().slice(0, 10) : null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const { error: err } = await supabase
          .from('finance_revenues')
          .update(payload)
          .eq('id', revenue!.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('finance_revenues').insert(payload);
        if (err) throw err;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar receita:', err);
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
            {isEdit ? 'Editar receita' : 'Nova receita'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rev-source">Origem</Label>
            <Input
              id="rev-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Cliente / projeto"
              className="bg-black/30 border-white/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rev-month">Competência</Label>
              <Input
                id="rev-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-black/30 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-amount">Valor (USD)</Label>
              <Input
                id="rev-amount"
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

          <div className="space-y-2">
            <Label htmlFor="rev-desc">Descrição</Label>
            <Textarea
              id="rev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
              className="bg-black/30 border-white/10 min-h-[60px]"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={received}
              onChange={(e) => setReceived(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            <span className="text-sm text-white/80">Já recebido</span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinanceRevenueModal;
