-- ============================================================
-- Remoção do módulo FINANCEIRO
--
-- Desfaz tudo que foi criado em:
--   0007_finance.sql, 0008_finance_seed.sql, 0009_finance_biweekly.sql
--
-- Remove tabelas, função/trigger e tipos auxiliares.
-- ATENÇÃO: apaga permanentemente os dados financeiros.
-- ============================================================

-- tabelas (cascade derruba índices, policies, constraints e o trigger)
drop table if exists public.finance_entries  cascade;
drop table if exists public.finance_revenues cascade;
drop table if exists public.finance_items    cascade;

-- função do trigger de updated_at (usada apenas pelo módulo financeiro)
drop function if exists public.set_finance_updated_at() cascade;

-- tipos auxiliares
drop type if exists public.finance_period;
drop type if exists public.finance_recurrence;
drop type if exists public.finance_category;
