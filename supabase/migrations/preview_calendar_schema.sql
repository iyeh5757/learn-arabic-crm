-- ============================================================
-- PREVIEW MIGRATION — Calendar & Scheduling Hub
-- DO NOT apply to production until explicitly approved.
-- Apply to a Supabase staging branch first for testing.
-- ============================================================

-- 1. Configurable session types (colors, dialects)
create table if not exists session_type_config (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null,
  description text,
  is_active   boolean default true,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

insert into session_type_config (name, color, sort_order) values
  ('Trial',            '#EF4444', 1),
  ('Egyptian Arabic',  '#22C55E', 2),
  ('MSA',              '#3B82F6', 3),
  ('Gulf Arabic',      '#A855F7', 4),
  ('Levantine Arabic', '#F97316', 5),
  ('Quran',            '#EAB308', 6),
  ('Blocked',          '#9CA3AF', 7)
on conflict (name) do nothing;

-- 2. Recurring schedule rules
create table if not exists recurring_rules (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid references teachers(id) on delete cascade,
  student_id       uuid references students(id) on delete set null,
  session_type_id  uuid references session_type_config(id),
  days_of_week     int[] not null,          -- [1,3,5] = Mon/Wed/Fri (0=Sun)
  start_time       time not null,
  duration_minutes int not null default 60,
  timezone         text not null default 'Africa/Cairo',
  until_date       date,                     -- null = never-ending (rolling generation)
  is_active        boolean default true,
  notes            text,
  created_by       uuid references profiles(id),
  created_at       timestamptz default now()
);

-- 3. Main calendar sessions table
create table if not exists calendar_sessions (
  id                  uuid primary key default gen_random_uuid(),
  title               text,
  session_type_id     uuid references session_type_config(id),
  teacher_id          uuid references teachers(id) on delete restrict,
  student_id          uuid references students(id) on delete set null,
  student_name        text,                 -- denormalized for speed
  student_email       text,
  student_phone       text,
  start_at            timestamptz not null,
  end_at              timestamptz not null,
  duration_minutes    int not null,
  timezone            text not null default 'Africa/Cairo',
  status              text not null default 'scheduled'
                      check (status in ('scheduled','completed','cancelled',
                                        'rescheduled','no_show','blocked')),
  notes               text,
  sales_notes         text,
  supervisor_notes    text,
  -- Recurring
  recurring_rule_id   uuid references recurring_rules(id) on delete set null,
  is_recurring_root   boolean default false,
  -- Google sync
  google_event_id     text unique,
  google_meet_link    text,
  google_calendar_id  text,
  google_synced_at    timestamptz,
  -- Force booking
  force_booked        boolean default false,
  force_booked_by     uuid references profiles(id),
  force_booked_reason text,
  -- Reminders (24h, 12h, 1h)
  reminder_24h_sent   boolean default false,
  reminder_12h_sent   boolean default false,
  reminder_1h_sent    boolean default false,
  -- Audit
  created_by          uuid references profiles(id),
  updated_by          uuid references profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- 4. Weekly availability templates per teacher
create table if not exists teacher_availability (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid references teachers(id) on delete cascade,
  day_of_week  int not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  timezone     text not null default 'Africa/Cairo',
  is_active    boolean default true,
  created_at   timestamptz default now(),
  unique (teacher_id, day_of_week, start_time)
);

-- 5. Ad-hoc blocked time slots
create table if not exists calendar_blocks (
  id                  uuid primary key default gen_random_uuid(),
  teacher_id          uuid references teachers(id) on delete cascade,
  start_at            timestamptz not null,
  end_at              timestamptz not null,
  reason              text,
  recurrence_group_id uuid,            -- groups blocks created as one recurring series
  google_event_id     text,
  created_by          uuid references profiles(id),
  created_at          timestamptz default now()
);

-- 6. Per-user Google OAuth tokens
create table if not exists google_integrations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references profiles(id) on delete cascade unique,
  access_token         text,
  refresh_token        text,
  token_expiry         timestamptz,
  google_email         text,
  calendar_id          text default 'primary',
  sync_enabled         boolean default true,
  webhook_channel_id   text,
  webhook_resource_id  text,
  webhook_expiry       timestamptz,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- 7. Reminder delivery log
create table if not exists session_reminder_log (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references calendar_sessions(id) on delete cascade,
  hours_before int not null check (hours_before in (24, 12, 1)),
  channel     text not null check (channel in ('whatsapp', 'email')),
  sent_to     text not null,
  status      text not null check (status in ('sent', 'failed')),
  error       text,
  sent_at     timestamptz default now()
);

-- 8. Full audit log
create table if not exists calendar_audit_log (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid,
  action       text not null
               check (action in ('created','updated','cancelled','rescheduled',
                                  'force_booked','deleted','reminder_sent')),
  performed_by uuid references profiles(id),
  old_data     jsonb,
  new_data     jsonb,
  source       text default 'crm' check (source in ('crm','google','cron')),
  created_at   timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_cal_sessions_teacher_start  on calendar_sessions (teacher_id, start_at);
create index if not exists idx_cal_sessions_student        on calendar_sessions (student_id);
create index if not exists idx_cal_sessions_google_event   on calendar_sessions (google_event_id);
create index if not exists idx_cal_sessions_recurring      on calendar_sessions (recurring_rule_id);
create index if not exists idx_cal_sessions_reminders      on calendar_sessions (start_at) where reminder_24h_sent = false or reminder_12h_sent = false or reminder_1h_sent = false;
create index if not exists idx_teacher_avail               on teacher_availability (teacher_id, day_of_week);
create index if not exists idx_calendar_blocks             on calendar_blocks (teacher_id, start_at);
create index if not exists idx_audit_log_event             on calendar_audit_log (event_id);

-- RLS policies (project pattern: to public + current_user_role())
alter table session_type_config    enable row level security;
alter table recurring_rules        enable row level security;
alter table calendar_sessions      enable row level security;
alter table teacher_availability   enable row level security;
alter table calendar_blocks        enable row level security;
alter table google_integrations    enable row level security;
alter table session_reminder_log   enable row level security;
alter table calendar_audit_log     enable row level security;

-- session_type_config: everyone can read, only admin can modify
create policy "Anyone can read session types" on session_type_config
  for select to public using (true);
create policy "Admin can manage session types" on session_type_config
  for all to public using (current_user_role() = 'admin');

-- calendar_sessions
create policy "Admin sees all sessions" on calendar_sessions
  for select to public using (current_user_role() = 'admin');

create policy "Supervisor sees own teachers sessions" on calendar_sessions
  for select to public using (
    current_user_role() = 'supervisor' and
    exists (select 1 from teachers t where t.id = calendar_sessions.teacher_id and t.supervisor_id = auth.uid())
  );

create policy "Sales sees all sessions" on calendar_sessions
  for select to public using (current_user_role() = 'sales');

create policy "Teacher sees own sessions" on calendar_sessions
  for select to public using (
    current_user_role() = 'teacher' and
    exists (select 1 from teachers t where t.id = calendar_sessions.teacher_id and t.user_id = auth.uid())
  );

create policy "Admin and sales can insert sessions" on calendar_sessions
  for insert to public with check (current_user_role() in ('admin', 'sales', 'supervisor'));

create policy "Admin and sales can update sessions" on calendar_sessions
  for update to public using (current_user_role() in ('admin', 'sales', 'supervisor'));

create policy "Admin can delete sessions" on calendar_sessions
  for delete to public using (current_user_role() = 'admin');

-- teacher_availability
create policy "Read availability" on teacher_availability
  for select to public using (current_user_role() in ('admin','supervisor','sales','teacher'));

create policy "Teacher manages own availability" on teacher_availability
  for all to public using (
    current_user_role() = 'teacher' and
    exists (select 1 from teachers t where t.id = teacher_availability.teacher_id and t.user_id = auth.uid())
  );

create policy "Admin manages all availability" on teacher_availability
  for all to public using (current_user_role() = 'admin');

-- calendar_blocks
create policy "Teacher manages own blocks" on calendar_blocks
  for all to public using (
    current_user_role() = 'teacher' and
    exists (select 1 from teachers t where t.id = calendar_blocks.teacher_id and t.user_id = auth.uid())
  );
create policy "Admin manages all blocks" on calendar_blocks
  for all to public using (current_user_role() = 'admin');
create policy "Supervisor manages team blocks" on calendar_blocks
  for all to public using (
    current_user_role() = 'supervisor' and
    exists (select 1 from teachers t where t.id = calendar_blocks.teacher_id and t.supervisor_id = auth.uid())
  );
create policy "Sales reads blocks" on calendar_blocks
  for select to public using (current_user_role() = 'sales');

-- google_integrations: own row only
create policy "User manages own google integration" on google_integrations
  for all to public using (user_id = auth.uid());

-- reminder log: admin + cron can read
create policy "Admin reads reminder log" on session_reminder_log
  for select to public using (current_user_role() = 'admin');

create policy "System can insert reminder log" on session_reminder_log
  for insert to public with check (current_user_role() in ('admin','sales','supervisor'));

-- audit log: admin and supervisor can read
create policy "Read audit log" on calendar_audit_log
  for select to public using (current_user_role() in ('admin','supervisor'));

-- ============================================================
-- END OF PREVIEW MIGRATION
-- To apply: Supabase Dashboard → SQL Editor → paste and run
-- Apply to staging branch first, never directly to production
-- ============================================================
