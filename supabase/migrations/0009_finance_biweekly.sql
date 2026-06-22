-- ============================================================
-- Pagamento QUINZENAL dos desenvolvedores
--
-- A empresa paga os devs em duas parcelas por mês:
--   • dia 20 — referente aos dias 1–15 do mês corrente   (1ª quinzena)
--   • dia 05 — referente aos dias 16–31 do mês ANTERIOR  (2ª quinzena)
--
-- Modelagem: cada competência (mês) de um dev quinzenal passa a ter
-- DOIS lançamentos em finance_entries, distinguidos por `period`.
-- O `pay_day` guarda o dia de pagamento de cada parcela (20 ou 5).
--
-- Exceção: Guilherme permanece mensal (recurrence = 'monthly').
-- Lançamentos históricos importados continuam como period='full'.
-- ============================================================

-- ── enum do período da parcela ──
do $$ begin
  create type finance_period as enum ('full', 'first_half', 'second_half');
exception when duplicate_object then null; end $$;

-- ── novas colunas em finance_entries ──
alter table public.finance_entries
  add column if not exists period  finance_period not null default 'full',
  -- dia de pagamento da parcela (ex.: 20 = 1ª quinzena, 5 = 2ª quinzena)
  add column if not exists pay_day smallint check (pay_day between 1 and 31);

-- ── índice único agora considera o período ──
-- (permite 2 parcelas no mesmo item/competência)
drop index if exists public.uq_finance_entries_item_month;
create unique index if not exists uq_finance_entries_item_month_period
  on public.finance_entries(item_id, competence, period) where item_id is not null;

create index if not exists idx_finance_entries_period on public.finance_entries(period);

-- ── devs passam a ser quinzenais (exceto Guilherme) ──
update public.finance_items
   set recurrence = 'biweekly'
 where category = 'developer'
   and name <> 'Guilherme';

-- Guilherme permanece mensal (garantia idempotente).
update public.finance_items
   set recurrence = 'monthly'
 where category = 'developer'
   and name = 'Guilherme';
