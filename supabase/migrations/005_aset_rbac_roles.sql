-- ISSUE-44: Server-controlled roles + asset ownership/scope columns (idempotent).

-- 1) user_roles — roles assigned server-side (service_role writes only).
create table if not exists public.user_roles (
  id bigint generated always as identity primary key,
  user_id text not null,
  role text not null default 'viewer' check (role in ('viewer', 'pic', 'admin')),
  granted_by text not null default '',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, role, revoked_at)
);
alter table public.user_roles enable row level security;

-- 2) Asset schema parity with lib/aset-supabase.js: ownership + scope columns.
--    Idempotent so deployments that already applied 002_aset.sql get upgraded.
alter table public.aset add column if not exists owner_id text;
alter table public.aset add column if not exists pic_ids text[] not null default '{}';
alter table public.aset add column if not exists lokasi text not null default '';
alter table public.aset add column if not exists keterangan text not null default '';
alter table public.aset add column if not exists assignee_id text;
alter table public.aset add column if not exists transfer_to_id text;

-- 3) Indexes/constraints for scope lookups.
create index if not exists idx_aset_owner_id on public.aset(owner_id);
create index if not exists idx_aset_status on public.aset(status);
create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

-- 4) RLS policies — only service_role (server) may touch; anon/authenticated denied.
drop policy if exists "allow service_role all user_roles" on public.user_roles;
create policy "allow service_role all user_roles"
  on public.user_roles for all
  to service_role
  using (true) with check (true);

-- 5) A single-statement conditional update for lifecycle transitions
--    (predicate: kode + current status), executed atomically.
create or replace function public.atur_status_aset(
  p_kode text[],
  p_status text,
  p_owner_id text default null,
  p_pic_ids text[] default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.aset set status = p_status, updated_at = now()
  where kode = any(p_kode)
    and status <> p_status
    and (p_owner_id is null or owner_id = p_owner_id)
    and (p_pic_ids is null or pic_ids && p_pic_ids);
end;
$$;

revoke all on function public.atur_status_aset(text[], text, text, text[]) from public, anon, authenticated;
grant execute on function public.atur_status_aset(text[], text, text, text[]) to service_role;