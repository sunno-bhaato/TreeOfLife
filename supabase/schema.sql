-- TreeOfLife: run this whole file once in Supabase → SQL Editor.

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  photo_url text,
  parent_union_id uuid,
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  created_at timestamptz not null default now()
);

-- A "union" is a couple (a + b) or a single parent (b is null).
-- Children point at the union they were born into, so their arrows start at the midpoint of the couple's line.
create table public.unions (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references public.people(id) on delete cascade,
  b_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  check (a_id <> b_id)
);

alter table public.people
  add constraint people_parent_union_fk
  foreign key (parent_union_id) references public.unions(id) on delete set null;

create index on public.people (parent_union_id);
create index on public.unions (a_id);
create index on public.unions (b_id);

-- ---------- who is an admin ----------
create table public.admins (email text primary key);
alter table public.admins enable row level security;  -- no policies: not readable through the API

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- row level security: everyone reads, only admins write ----------
alter table public.people enable row level security;
alter table public.unions enable row level security;

create policy "anyone can read people" on public.people for select using (true);
create policy "anyone can read unions" on public.unions for select using (true);

create policy "admins insert people" on public.people for insert to authenticated with check (public.is_admin());
create policy "admins update people" on public.people for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete people" on public.people for delete to authenticated using (public.is_admin());

create policy "admins insert unions" on public.unions for insert to authenticated with check (public.is_admin());
create policy "admins update unions" on public.unions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete unions" on public.unions for delete to authenticated using (public.is_admin());

-- ---------- photo storage ----------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "anyone can view photos" on storage.objects for select using (bucket_id = 'photos');
create policy "admins upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());
create policy "admins update photos" on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_admin());
create policy "admins delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_admin());

-- ---------- make yourself an admin (change the email, then run) ----------
-- insert into public.admins (email) values ('you@example.com');
