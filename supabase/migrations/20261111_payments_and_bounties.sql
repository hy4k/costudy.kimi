-- Payments ledger extensions + mentor bounties (applied live 2026-11-11)

-- Razorpay order id + platform fee + human label on the payment ledger
alter table public.session_payments
  add column if not exists order_id text,
  add column if not exists costudy_fee numeric default 0,
  add column if not exists label text;

-- Mentor student bounties: a task with a reward, posted by faculty
create table if not exists public.mentor_bounties (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.user_profiles(id) on delete cascade,
  task text not null,
  reward numeric default 0,
  type text default 'CREDITS',
  status text default 'OPEN',
  created_at timestamptz default now()
);

alter table public.mentor_bounties enable row level security;

-- authenticated users can read bounties
create policy "bounties_select" on public.mentor_bounties
  for select to authenticated using (true);

-- mentors post their own bounties
create policy "bounties_insert_own" on public.mentor_bounties
  for insert to authenticated with check (teacher_id = auth.uid());

-- mentors manage their own bounties
create policy "bounties_update_own" on public.mentor_bounties
  for update to authenticated using (teacher_id = auth.uid());
