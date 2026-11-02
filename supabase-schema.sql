-- Run this in Supabase > SQL Editor after creating your project.
-- Public visitors can INSERT enquiries only. Authenticated admin can read/update.
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) <= 100),
  email text not null check (char_length(email) <= 160),
  phone text check (char_length(phone) <= 40),
  residence text check (char_length(residence) <= 80),
  destination text not null,
  purpose text not null,
  travel_timing text check (char_length(travel_timing) <= 100),
  message text not null check (char_length(message) <= 2000),
  consent boolean not null default false,
  status text not null default 'New'
    check (status in ('New','In progress','Awaiting customer','Closed'))
);

alter table public.enquiries enable row level security;

drop policy if exists "Anyone can submit an enquiry" on public.enquiries;
create policy "Anyone can submit an enquiry"
on public.enquiries for insert
to anon, authenticated
with check (consent = true and status = 'New');

drop policy if exists "Admins can read enquiries" on public.enquiries;
create policy "Admins can read enquiries"
on public.enquiries for select
to authenticated
using (true);

drop policy if exists "Admins can update enquiries" on public.enquiries;
create policy "Admins can update enquiries"
on public.enquiries for update
to authenticated
using (true)
with check (status in ('New','In progress','Awaiting customer','Closed'));

-- IMPORTANT: create only your own administrator user in Supabase Authentication.
-- Do not enable public sign-ups for this admin-only dashboard.
