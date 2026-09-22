-- Cidade + coordenadas próprias do evento (spec explorar-redesign 3.2).
-- Permite que o evento seja encontrado pela cidade que o criou, mesmo sem
-- destino vinculado (o local costuma ser texto livre no ponto de encontro).
-- Idempotente.

alter table public.events add column if not exists city text;
alter table public.events add column if not exists latitude numeric;
alter table public.events add column if not exists longitude numeric;

create index if not exists idx_events_city on public.events(city);
