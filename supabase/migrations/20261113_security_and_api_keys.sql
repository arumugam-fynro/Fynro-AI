-- Fynro: closed sign-ups + encrypted per-user Anthropic API key storage.
-- Run once in the Supabase SQL editor of the project that SUPABASE_URL points at.

-- 1) Close public sign-ups at the database level -------------------------------------------------
-- Only emails on this list can ever become users, no matter who calls the Auth API.
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email))
);
alter table public.allowed_emails enable row level security;       -- no policies: invisible to anon/authenticated
revoke all on public.allowed_emails from anon, authenticated;

create or replace function public.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'Sign-ups are closed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_allowed_email() from public, anon, authenticated;

drop trigger if exists enforce_allowed_email on auth.users;
create trigger enforce_allowed_email
  before insert on auth.users
  for each row execute function public.enforce_allowed_email();

insert into public.allowed_emails (email) values ('arumugam@fynro.in') on conflict do nothing;

-- 2) Per-user API key, stored encrypted (AES-256-GCM, done in the Next.js server) ---------------
create table if not exists public.user_api_keys (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  ciphertext text not null,                -- never plaintext; only the server can decrypt it
  hint       text not null,                -- e.g. "sk-ant-…x7Qd", safe to show in the UI
  updated_at timestamptz not null default now()
);
alter table public.user_api_keys enable row level security;
revoke all on public.user_api_keys from anon;

create policy "read own key"   on public.user_api_keys for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own key" on public.user_api_keys for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own key" on public.user_api_keys for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own key" on public.user_api_keys for delete to authenticated using ((select auth.uid()) = user_id);
