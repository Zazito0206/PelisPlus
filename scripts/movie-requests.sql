create extension if not exists pgcrypto;

create table if not exists public.movie_requests (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  contacto text,
  detalle text,
  estado text not null default 'pendiente',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint movie_requests_estado_check check (estado in ('pendiente', 'agregada'))
);

alter table public.movie_requests enable row level security;

drop policy if exists "Public can insert movie requests" on public.movie_requests;
create policy "Public can insert movie requests"
on public.movie_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated can read movie requests" on public.movie_requests;
create policy "Authenticated can read movie requests"
on public.movie_requests
for select
to authenticated
using (true);

drop policy if exists "Authenticated can update movie requests" on public.movie_requests;
create policy "Authenticated can update movie requests"
on public.movie_requests
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete movie requests" on public.movie_requests;
create policy "Authenticated can delete movie requests"
on public.movie_requests
for delete
to authenticated
using (true);

create or replace function public.touch_movie_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_movie_requests_updated_at on public.movie_requests;
create trigger trg_movie_requests_updated_at
before update on public.movie_requests
for each row
execute function public.touch_movie_requests_updated_at();
