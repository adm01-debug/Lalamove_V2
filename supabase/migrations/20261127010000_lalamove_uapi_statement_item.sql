-- Lançamentos do extrato guardados pela própria identidade.
--
-- O gateway pagina o extrato por posição e não devolve id por lançamento. Entre
-- a janela recente (refeita a cada ciclo do coletor) e o histórico congelado a
-- posição de um lançamento muda, então uma página montada por posição pode
-- repetir ou pular lançamentos. Guardando cada lançamento pela sua identidade, a
-- página passa a ser montada por chave e a borda deixa de existir.

create table if not exists public.lalamove_uapi_statement_item (
  item_key text primary key,
  city_id integer,
  occurred_at_local timestamp without time zone not null,
  payload jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.lalamove_uapi_statement_item is
  'Lançamentos do extrato UAPI deduplicados por conteúdo (item_key). Base da paginação por chave montada na edge.';
comment on column public.lalamove_uapi_statement_item.item_key is
  'Identidade do lançamento: city_id|date_time|amount|order_display_id|name|sub_name|user_fid|topup_tx_no.';
comment on column public.lalamove_uapi_statement_item.occurred_at_local is
  'date_time do gateway (hora local da cidade, sem fuso) — usado só para ordenar.';

create index if not exists lalamove_uapi_statement_item_paginate_idx
  on public.lalamove_uapi_statement_item (occurred_at_local desc, item_key desc);

alter table public.lalamove_uapi_statement_item enable row level security;

-- Sem policy: só o service_role (coletor e edge) lê e escreve.
revoke all on public.lalamove_uapi_statement_item from anon, authenticated;
grant all on public.lalamove_uapi_statement_item to service_role;
