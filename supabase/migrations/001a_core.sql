-- VorldX 001a: core tables (companies, profiles, memberships, shifts, employees)
-- NOTE: tables before helper functions (SQL functions validate table existence)
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.handle_updated_at();

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin','hr','employee')),
  status text not null default 'active' check (status in ('active','pending','invited','suspended','deactivated')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index if not exists idx_memberships_user on public.company_memberships(user_id);
create index if not exists idx_memberships_company on public.company_memberships(company_id);

-- helpers after memberships table exists
create or replace function public.is_company_member(_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_memberships m
    where m.company_id = _company_id and m.user_id = auth.uid() and m.status = 'active'); $$;

create or replace function public.company_role(_company_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.company_memberships m
  where m.company_id = _company_id and m.user_id = auth.uid() and m.status = 'active' limit 1; $$;

create or replace function public.is_company_admin(_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_memberships m
    where m.company_id = _company_id and m.user_id = auth.uid()
    and m.role = 'admin' and m.status = 'active'); $$;

create or replace function public.is_company_hr(_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_memberships m
    where m.company_id = _company_id and m.user_id = auth.uid()
    and m.role in ('admin','hr') and m.status = 'active'); $$;

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  start_time time not null,
  end_time time not null,
  grace_period_minutes int not null default 10 check (grace_period_minutes between 0 and 120),
  working_days int[] not null default '{1,2,3,4,5}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_shifts_company on public.shifts(company_id);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid,
  employee_code text not null check (char_length(trim(employee_code)) between 1 and 40),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null,
  department text not null default 'General',
  designation text not null default 'Associate',
  joining_date date not null default current_date,
  shift_id uuid references public.shifts(id) on delete set null,
  work_type text not null default 'office' check (work_type in ('office','wfh','hybrid')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_code)
);
create unique index if not exists uq_employees_company_email on public.employees(company_id, lower(email));
create index if not exists idx_employees_company on public.employees(company_id);
create index if not exists idx_employees_user on public.employees(user_id);
drop trigger if exists trg_employees_updated on public.employees;
create trigger trg_employees_updated before update on public.employees
  for each row execute function public.handle_updated_at();
