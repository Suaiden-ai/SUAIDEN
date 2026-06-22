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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../jobs/ui/select';

export type FinanceCategory = 'developer' | 'tool';
export type FinanceRecurrence = 'fixed' | 'monthly' | 'biweekly' | 'annual' | 'one_time';

export interface FinanceItem {
  id: string;
  category: FinanceCategory;
  name: string;
  recurrence: FinanceRecurrence;
  base_amount: number;
  currency: string;
  due_day: number | null;
  billing_source: string | null;
  active: boolean;
  notes: string | null;
}

const RECURRENCE_OPTIONS: { value: FinanceRecurrence; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'annual', label: 'Anual' },
  { value: 'fixed', label: 'Fixo' },
  { value: 'one_time', label: 'Único' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  // categoria fixa ao criar; ao editar vem do item
  category: FinanceCategory;
  item?: FinanceItem | null;
}

const FinanceItemModal: React.FC<Props> = ({ open, onClose, onSaved, category, item }) => {
  const isEdit = !!item;
  const [name, setName] = useState('');
  const [recurrence, setRecurrence] = useState<FinanceRecurrence>('monthly');
  const [baseAmount, setBaseAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [billingSource, setBillingSource] = useState('');
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (item) {
      setName(item.name);
      setRecurrence(item.recurrence);
      setBaseAmount(String(item.base_amount ?? ''));
      setDueDay(item.due_day ? String(item.due_day) : '');
      setBillingSource(item.billing_source || '');
      setActive(item.active);
      setNotes(item.notes || '');
    } else {
      setName('');
      setRecurrence('monthly');
      setBaseAmount('');
      setDueDay('');
      setBillingSource('');
      setActive(true);
      setNotes('');
    }
  }, [open, item]);

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Informe o nome.');
      return;
    }
    const dueDayNum = dueDay.trim() ? Number(dueDay) : null;
    if (dueDayNum !== null && (Number.isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31)) {
      setError('Dia de vencimento deve estar entre 1 e 31.');
      return;
    }

    const payload = {
      category: isEdit ? item!.category : category,
      name: name.trim(),
      recurrence,
      base_amount: baseAmount.trim() ? Number(baseAmount) : 0,
      due_day: dueDayNum,
      billing_source: billingSource.trim() || null,
      active,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        const { error: err } = await supabase
          .from('finance_items')
          .update(payload)
          .eq('id', item!.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('finance_items').insert(payload);
        if (err) throw err;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar item financeiro:', err);
      setError(err?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = (isEdit ? item!.category : category) === 'developer' ? 'desenvolvedor' : 'ferramenta';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#1d2125] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            {isEdit ? `Editar ${categoryLabel}` : `Novo(a) ${categoryLabel}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="fin-name">Nome</Label>
            <Input
              id="fin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={category === 'developer' ? 'Ex.: João' : 'Ex.: VPS 1'}
              className="bg-black/30 border-white/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as FinanceRecurrence)}>
                <SelectTrigger className="bg-black/30 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1d2125] border-white/10 text-white">
                  {RECURRENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fin-amount">Valor base (USD)</Label>
              <Input
                id="fin-amount"
                type="number"
                step="0.01"
                min="0"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                placeholder="0.00"
                className="bg-black/30 border-white/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fin-due">Dia de vencimento</Label>
              <Input
                id="fin-due"
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="1–31"
                className="bg-black/30 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fin-billing">Fonte de cobrança</Label>
              <Input
                id="fin-billing"
                value={billingSource}
                onChange={(e) => setBillingSource(e.target.value)}
                placeholder="Cartão, boleto, Stripe…"
                className="bg-black/30 border-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fin-notes">Observações</Label>
            <Textarea
              id="fin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="bg-black/30 border-white/10 min-h-[72px]"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-[#8334ff]"
            />
            <span className="text-sm text-white/80">Ativo</span>
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

export default FinanceItemModal;
