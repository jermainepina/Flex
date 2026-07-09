-- Pre-AI polish: user settings. Run in the Supabase SQL editor (after 0005).
--
-- 1. Display name (greeting + settings; optionally set at sign-up).
-- 2. Theme preference: light / dim / dark (default dark).
-- 3. handle_new_user() copies display_name from the sign-up metadata.

alter table public.profiles
  add column display_name text;

alter table public.profiles
  add column theme text not null default 'dark' check (theme in ('light', 'dim', 'dark'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data->>'display_name'), ''));
  return new;
end;
$$;
