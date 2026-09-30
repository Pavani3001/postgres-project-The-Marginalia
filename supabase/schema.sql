create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  reminder_at timestamptz,
  reminder_sent_at timestamptz
);

alter table public.notes add column if not exists reminder_at timestamptz;
alter table public.notes add column if not exists reminder_sent_at timestamptz;
create index if not exists notes_due_reminders_idx on public.notes (reminder_at) where reminder_at is not null and reminder_sent_at is null;

alter table public.notes enable row level security;

drop policy if exists "Users can read their own notes" on public.notes;
create policy "Users can read their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own notes" on public.notes;
create policy "Users can create their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';