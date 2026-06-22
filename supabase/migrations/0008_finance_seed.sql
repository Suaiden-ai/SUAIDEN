-- ============================================================
-- SEED do módulo financeiro a partir do relatório anual
-- (SUAIDEN_Relatorio_2025-06_2026-05.md / SUAIDEN - FINANCEIRO.xlsx)
--
-- Período: Jun/2025 → Mai/2026.
--
-- Importa:
--   • finance_items  — 1 item por desenvolvedor e por ferramenta
--   • finance_entries — valor mensal real de cada item
--
-- Idempotente: limpa os lançamentos importados e re-insere. Os
-- itens usam upsert por (category, name).
-- ============================================================

-- ── 1) CADASTRO de itens (idempotente por category+name) ──
-- Garante unicidade de nome dentro da categoria para o upsert funcionar.
create unique index if not exists uq_finance_items_category_name
  on public.finance_items(category, name);

insert into public.finance_items (category, name, recurrence, base_amount, billing_source, active, notes)
values
  -- Desenvolvedores (recorrência mensal). active reflete presença em Mai/2026.
  ('developer', 'Paulo',           'monthly', 650.00,  null, true,  'Presente nos 12 meses do relatório.'),
  ('developer', 'João Victor',     'monthly', 500.00,  null, false, 'Último pagamento em Dez/2025.'),
  ('developer', 'Gilson',          'monthly', 500.00,  null, false, 'Último pagamento em Nov/2025.'),
  ('developer', 'Guilherme',       'monthly', 2900.00, null, true,  'Contrato: $2.500 (Jun-Jul/25) → $2.800 (Ago-Out/25) → $2.900 (Nov/25+). Sem pagamento registrado Jun–Ago/2025.'),
  ('developer', 'Antonio',         'monthly', 500.00,  null, false, 'Último pagamento em Fev/2026.'),
  ('developer', 'Henrique',        'monthly', 500.00,  null, true,  null),
  ('developer', 'Matheus',         'monthly', 500.00,  null, true,  null),
  ('developer', 'Gustavo',         'monthly', 500.00,  null, true,  null),
  ('developer', 'Luana',           'monthly', 500.00,  null, true,  null),
  ('developer', 'Anderson Vilela', 'monthly', 500.00,  null, true,  null),
  -- Ferramentas / Infraestrutura
  ('tool', 'VPS 1',              'monthly', 15.00, null, true, null),
  ('tool', 'VPS 2',              'monthly', 15.00, null, true, null),
  ('tool', 'Supabase Matrícula', 'monthly', 34.68, 'Supabase', true, null),
  ('tool', 'Supabase TFOE',      'monthly', 25.00, 'Supabase', true, null),
  ('tool', 'Supabase 323',       'monthly', 25.00, 'Supabase', true, null),
  ('tool', 'Waltlabs',           'monthly', 28.44, 'Waltlabs', true, 'Mai/2026 com cobrança atípica de $4.839,39 — verificar (cobrança acumulada/renovação anual ou erro).')
on conflict (category, name) do update
  set base_amount    = excluded.base_amount,
      billing_source = excluded.billing_source,
      active         = excluded.active,
      notes          = excluded.notes;

-- ── 2) LANÇAMENTOS mensais ──
-- Limpa lançamentos anteriores destes itens (re-execução limpa).
delete from public.finance_entries
where item_id in (select id from public.finance_items);

-- Insere a partir de uma lista (categoria, nome, mês, valor), juntando
-- ao cadastro pelo par (category, name).
with raw(category, name, competence, amount, flagged) as (
  values
    -- ===================== DESENVOLVEDORES =====================
    ('developer','Paulo','2025-06-01',500.00,false),
    ('developer','Paulo','2025-07-01',500.00,false),
    ('developer','Paulo','2025-08-01',600.00,false),
    ('developer','Paulo','2025-09-01',600.00,false),
    ('developer','Paulo','2025-10-01',600.00,false),
    ('developer','Paulo','2025-11-01',600.00,false),
    ('developer','Paulo','2025-12-01',600.00,false),
    ('developer','Paulo','2026-01-01',600.00,false),
    ('developer','Paulo','2026-02-01',600.00,false),
    ('developer','Paulo','2026-03-01',600.00,false),
    ('developer','Paulo','2026-04-01',338.00,false),
    ('developer','Paulo','2026-05-01',650.00,false),

    ('developer','João Victor','2025-06-01',500.00,false),
    ('developer','João Victor','2025-07-01',500.00,false),
    ('developer','João Victor','2025-08-01',500.00,false),
    ('developer','João Victor','2025-09-01',500.00,false),
    ('developer','João Victor','2025-10-01',500.00,false),
    ('developer','João Victor','2025-11-01',500.00,false),
    ('developer','João Victor','2025-12-01',274.00,false),

    ('developer','Gilson','2025-06-01',117.00,false),
    ('developer','Gilson','2025-07-01',500.00,false),
    ('developer','Gilson','2025-08-01',500.00,false),
    ('developer','Gilson','2025-09-01',500.00,false),
    ('developer','Gilson','2025-10-01',500.00,false),
    ('developer','Gilson','2025-11-01',433.00,false),

    ('developer','Guilherme','2025-09-01',2000.00,false),
    ('developer','Guilherme','2025-10-01',2000.00,false),
    ('developer','Guilherme','2025-11-01',2000.00,false),
    ('developer','Guilherme','2025-12-01',2000.00,false),
    ('developer','Guilherme','2026-01-01',2000.00,false),
    ('developer','Guilherme','2026-02-01',2000.00,false),
    ('developer','Guilherme','2026-03-01',2000.00,false),
    ('developer','Guilherme','2026-04-01',2000.00,false),
    ('developer','Guilherme','2026-05-01',2000.00,false),

    ('developer','Antonio','2025-08-01',387.00,false),
    ('developer','Antonio','2025-09-01',500.00,false),
    ('developer','Antonio','2025-10-01',500.00,false),
    ('developer','Antonio','2025-11-01',500.00,false),
    ('developer','Antonio','2025-12-01',500.00,false),
    ('developer','Antonio','2026-01-01',500.00,false),
    ('developer','Antonio','2026-02-01',232.00,false),

    ('developer','Henrique','2026-01-01',500.00,false),
    ('developer','Henrique','2026-02-01',500.00,false),
    ('developer','Henrique','2026-03-01',500.00,false),
    ('developer','Henrique','2026-04-01',500.00,false),
    ('developer','Henrique','2026-05-01',500.00,false),

    ('developer','Matheus','2026-03-01',145.00,false),
    ('developer','Matheus','2026-04-01',500.00,false),
    ('developer','Matheus','2026-05-01',500.00,false),

    ('developer','Gustavo','2026-03-01',129.00,false),
    ('developer','Gustavo','2026-04-01',500.00,false),
    ('developer','Gustavo','2026-05-01',500.00,false),

    ('developer','Luana','2026-04-01',267.00,false),
    ('developer','Luana','2026-05-01',500.00,false),

    ('developer','Anderson Vilela','2026-03-01',500.00,false),
    ('developer','Anderson Vilela','2026-04-01',500.00,false),
    ('developer','Anderson Vilela','2026-05-01',500.00,false),

    -- ===================== FERRAMENTAS =====================
    ('tool','VPS 1','2025-06-01',15.00,false),
    ('tool','VPS 1','2025-07-01',15.00,false),
    ('tool','VPS 1','2025-08-01',15.00,false),
    ('tool','VPS 1','2025-09-01',15.00,false),
    ('tool','VPS 1','2025-10-01',15.00,false),
    ('tool','VPS 1','2025-11-01',15.00,false),
    ('tool','VPS 1','2025-12-01',15.00,false),
    ('tool','VPS 1','2026-01-01',15.00,false),
    ('tool','VPS 1','2026-02-01',15.00,false),
    ('tool','VPS 1','2026-03-01',15.00,false),
    ('tool','VPS 1','2026-04-01',15.00,false),
    ('tool','VPS 1','2026-05-01',15.00,false),

    ('tool','VPS 2','2025-06-01',15.00,false),
    ('tool','VPS 2','2025-07-01',15.00,false),
    ('tool','VPS 2','2025-08-01',15.00,false),
    ('tool','VPS 2','2025-09-01',15.00,false),
    ('tool','VPS 2','2025-10-01',15.00,false),
    ('tool','VPS 2','2025-11-01',15.00,false),
    ('tool','VPS 2','2025-12-01',15.00,false),
    ('tool','VPS 2','2026-01-01',15.00,false),
    ('tool','VPS 2','2026-02-01',15.00,false),
    ('tool','VPS 2','2026-03-01',15.00,false),
    ('tool','VPS 2','2026-04-01',15.00,false),
    ('tool','VPS 2','2026-05-01',15.00,false),

    ('tool','Supabase Matrícula','2025-10-01',25.00,false),
    ('tool','Supabase Matrícula','2025-11-01',25.00,false),
    ('tool','Supabase Matrícula','2025-12-01',25.00,false),
    ('tool','Supabase Matrícula','2026-01-01',25.00,false),
    ('tool','Supabase Matrícula','2026-02-01',25.00,false),
    ('tool','Supabase Matrícula','2026-03-01',25.00,false),
    ('tool','Supabase Matrícula','2026-04-01',29.62,false),
    ('tool','Supabase Matrícula','2026-05-01',34.68,false),

    ('tool','Supabase TFOE','2026-03-01',25.00,false),
    ('tool','Supabase TFOE','2026-04-01',25.00,false),
    ('tool','Supabase TFOE','2026-05-01',25.00,false),

    ('tool','Supabase 323','2026-04-01',25.00,false),
    ('tool','Supabase 323','2026-05-01',25.00,false),

    ('tool','Waltlabs','2025-10-01',46.60,false),
    ('tool','Waltlabs','2025-11-01',40.23,false),
    ('tool','Waltlabs','2025-12-01',36.23,false),
    ('tool','Waltlabs','2026-01-01',16.20,false),
    ('tool','Waltlabs','2026-02-01',13.20,false),
    ('tool','Waltlabs','2026-03-01',34.40,false),
    ('tool','Waltlabs','2026-04-01',10.38,false),
    ('tool','Waltlabs','2026-05-01',4839.39,true)
)
insert into public.finance_entries (item_id, category, name, competence, amount, flagged)
select fi.id, r.category::finance_category, r.name, r.competence::date, r.amount, r.flagged
from raw r
join public.finance_items fi
  on fi.category = r.category::finance_category and fi.name = r.name;
