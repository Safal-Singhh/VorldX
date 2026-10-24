-- VorldX 001b: policies, attendance, WFH, QR
create table if not exists public.attendance_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  wfh_enabled boolean not null default true,
  wfh_eligibility_rules text not null default '',
  request_cutoff_minutes int not null default 120 check (request_cutoff_minutes between 0 and 1440),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  attendance_type text not null check (attendance_type in ('office','wfh')),
  check_in_at timestamptz not null,
  check_out_at timestamptz check (check_out_at is null or check_out_at > check_in_at),
  status text not null check (status in ('present','late')),
  source text not null default 'qr' check (source in ('qr','passcode','manual','correction','import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_id, work_date)
);
create index if not exists idx_att_company_date on public.attendance_records(company_id, work_date);
create index if not exists idx_att_employee_date on public.attendance_records(employee_id, work_date);
create index if not exists idx_att_status on public.attendance_records(company_id, status);
create index if not exists idx_att_type on public.attendance_records(company_id, attendance_type);
drop trigger if exists trg_attendance_updated on public.attendance_records;
create trigger trg_attendance_updated before update on public.attendance_records
  for each row execute function public.handle_updated_at();

create table if not exists public.wfh_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_date date not null check (request_date >= current_date - interval '1 day'),
  reason text not null check (char_length(trim(reason)) between 5 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wfh_company_status_date on public.wfh_requests(company_id, status, request_date);
create index if not exists idx_wfh_employee on public.wfh_requests(employee_id, request_date);
drop trigger if exists trg_wfh_updated on public.wfh_requests;
create trigger trg_wfh_updated before update on public.wfh_requests
  for each row execute function public.handle_updated_at();

create table if not exists public.wfh_passcodes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  wfh_request_id uuid not null unique references public.wfh_requests(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  passcode_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  generated_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_pass_employee_date on public.wfh_passcodes(employee_id, work_date);

create table if not exists public.qr_displays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_name text not null,
  office_name text not null default 'HQ',
  is_active boolean not null default true,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists idx_displays_company on public.qr_displays(company_id);

create table if not exists public.qr_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_id uuid not null references public.qr_displays(id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists idx_qr_display_issued on public.qr_sessions(display_id, issued_at desc);
create index if not exists idx_qr_expiry on public.qr_sessions(expires_at);
