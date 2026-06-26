-- Retention: inactive students + contact-history log
-- Run in Supabase SQL Editor.

-- 1. Per-student inactive fields (latest summary)
alter table students add column if not exists recontact_date  date;
alter table students add column if not exists inactive_reason text;

-- 2. Full contact-history log (one row per contact attempt)
create table if not exists student_followups (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid references students(id) on delete cascade,
  note                text not null,
  next_recontact_date date,
  created_by          uuid references profiles(id),
  created_at          timestamptz default now()
);
create index if not exists idx_student_followups_student on student_followups (student_id, created_at desc);

alter table student_followups enable row level security;

create policy "Staff read followups" on student_followups
  for select to public using (current_user_role() in ('admin','sales','supervisor'));
create policy "Staff manage followups" on student_followups
  for all to public using (current_user_role() in ('admin','sales','supervisor'))
  with check (current_user_role() in ('admin','sales','supervisor'));
