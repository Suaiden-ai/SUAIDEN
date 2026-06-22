-- ============================================================
-- Módulo FINANCEIRO da empresa
--
-- Estrutura em duas camadas:
--
--  1) finance_items   — CADASTRO dos custos recorrentes da empresa
--     (desenvolvedores e ferramentas). Guarda o "contrato": valor
--     base, recorrência (mensal/anual/quinzenal/fixo/único), dia de
--     vencimento e por onde a cobrança é feita.
--
--  2) finance_entries — LANÇAMENTOS mensais reais. Cada linha é o
--     valor efetivamente pago de um item em uma competência (mês).
--     É a fonte do histórico (o relatório anual é importado aqui).
--
--  3) finance_revenues — RECEITAS / recebimentos da empresa.
--     Estrutura pronta para uso futuro (a página foca em custos agora).
--
-- Acesso é restrito a admin via is_admin() (migration 0002).
-- ============================================================

-- ── tipos auxiliares (enums tolerantes a re-execução) ──
do $$ begin
  create type finance_category as enum ('developer', 'tool');
exception when duplicate_object then null; end $$;

do $$ begin
  -- fixo: valor que não varia; mensal/quinzenal/anual: recorrências;
  -- one_time: cobrança avulsa.
  create type finance_recurrence as enum ('fixed', 'monthly', 'biweekly', 'annual', 'one_time');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 1) CADASTRO de itens de custo
-- ============================================================
create table if not exists public.finance_items (
  id            uuid primary key default gen_random_uuid(),
  category      finance_category not null,
  -- nome do dev ou da ferramenta (ex.: "Paulo", "VPS 1", "Waltlabs")
  name          text not null,
  -- vínculo opcional com o perfil do desenvolvedor (quando houver)
  profile_id    uuid references public.profiles(id) on delete set null,
  recurrence    finance_recurrence not null default 'monthly',
  -- valor base/contratual em USD (o valor real de cada mês fica em finance_entries)
  base_amount   numeric(12,2) not null default 0,
  currency      text not null default 'USD',
  -- dia do mês de vencimento (1..31), quando aplicável
  due_day       smallint check (due_day between 1 and 31),
  -- por onde a cobrança chega/é paga (cartão, boleto, Stripe, etc.)
  billing_source text,
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_finance_items_category on public.finance_items(category);
create index if not exists idx_finance_items_active   on public.finance_items(active);
create index if not exists idx_finance_items_profile  on public.finance_items(profile_id);

-- ============================================================
-- 2) LANÇAMENTOS mensais (histórico real)
-- ============================================================
create table if not exists public.finance_entries (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid references public.finance_items(id) on delete cascade,
  -- redundância proposital: sobrevive à exclusão do item e facilita relatórios
  category      finance_category not null,
  name          text not null,
  -- competência: primeiro dia do mês de referência (ex.: 2025-06-01)
  competence    date not null,
  amount        numeric(12,2) not null default 0,
  currency      text not null default 'USD',
  -- valor atípico / a verificar (ex.: Waltlabs Mai/2026)
  flagged       boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_finance_entries_item       on public.finance_entries(item_id);
create index if not exists idx_finance_entries_competence on public.finance_entries(competence);
create index if not exists idx_finance_entries_category   on public.finance_entries(category);
-- evita duplicar o mesmo item no mesmo mês
create unique index if not exists uq_finance_entries_item_month
  on public.finance_entries(item_id, competence) where item_id is not null;

-- ============================================================
-- 3) RECEITAS (uso futuro)
-- ============================================================
create table if not exists public.finance_revenues (
  id            uuid primary key default gen_random_uuid(),
  -- origem do recebimento (cliente/projeto/descrição)
  source        text not null,
  description   text,
  competence    date not null,
  amount        numeric(12,2) not null default 0,
  currency      text not null default 'USD',
  -- previsto vs. recebido
  received      boolean not null default false,
  received_at   date,
  created_at    timestamptz not null default now()
);

create index if not exists idx_finance_revenues_competence on public.finance_revenues(competence);

-- ── trigger para manter updated_at em finance_items ──
create or replace function public.set_finance_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_finance_items_updated_at on public.finance_items;
create trigger trg_finance_items_updated_at
  before update on public.finance_items
  for each row execute function public.set_finance_updated_at();

-- ============================================================
-- RLS — tudo restrito a admin
-- ============================================================
alter table public.finance_items    enable row level security;
alter table public.finance_entries  enable row level security;
alter table public.finance_revenues enable row level security;

-- finance_items
drop policy if exists "finance_items_admin_all" on public.finance_items;
create policy "finance_items_admin_all" on public.finance_items
  for all using (public.is_admin()) with check (public.is_admin());

-- finance_entries
drop policy if exists "finance_entries_admin_all" on public.finance_entries;
create policy "finance_entries_admin_all" on public.finance_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- finance_revenues
drop policy if exists "finance_revenues_admin_all" on public.finance_revenues;
create policy "finance_revenues_admin_all" on public.finance_revenues
  for all using (public.is_admin()) with check (public.is_admin());
