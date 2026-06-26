-- ============================================================
-- ParaPo — Supabase Database Schema  (safe to re-run)
-- ============================================================

-- IMPORTANT: Auth → Sign In / Providers → "Confirm email" → OFF

-- ── PROFILES ─────────────────────────────────────────────────
create table if not exists profiles (
  id               uuid references auth.users on delete cascade primary key,
  -- display name (derived from name parts)
  name             text not null,
  role             text not null check (role in ('passenger', 'driver', 'admin')),
  -- name parts
  surname          text,
  given_name       text,
  middle_initial   text,
  -- address
  house_no         text,
  street           text,
  brgy_purok       text,
  city_municipality text,
  province         text,
  zip_code         text,
  -- passenger verification
  id_photo_url     text,
  -- driver verification
  license_photo_url text,
  plate_number     text,
  toda_location    text,
  plate_photo_url  text,
  -- meta
  photo_url        text,
  average_rating   numeric(3,2) default null,
  is_verified      boolean default false,
  created_at       timestamptz default now()
);

-- Add new columns to existing table (idempotent)
alter table profiles add column if not exists surname text;
alter table profiles add column if not exists given_name text;
alter table profiles add column if not exists middle_initial text;
alter table profiles add column if not exists house_no text;
alter table profiles add column if not exists street text;
alter table profiles add column if not exists brgy_purok text;
alter table profiles add column if not exists city_municipality text;
alter table profiles add column if not exists province text;
alter table profiles add column if not exists zip_code text;
alter table profiles add column if not exists id_photo_url text;
alter table profiles add column if not exists license_photo_url text;
alter table profiles add column if not exists plate_number text;
alter table profiles add column if not exists toda_location text;
alter table profiles add column if not exists plate_photo_url text;
alter table profiles add column if not exists is_verified boolean default false;

alter table profiles enable row level security;

drop policy if exists "Users can read all profiles" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;

create policy "Users can read all profiles"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- ── TRIGGER: auto-create profile on signup ────────────────────
create or replace function handle_new_user()
returns trigger as $$
declare
  v_name text;
begin
  -- Build full name from parts, fall back to 'name' metadata
  v_name := trim(concat_ws(' ',
    nullif(trim(coalesce(new.raw_user_meta_data->>'given_name', '')), ''),
    case
      when nullif(trim(coalesce(new.raw_user_meta_data->>'middle_initial', '')), '') is not null
      then trim(new.raw_user_meta_data->>'middle_initial') || '.'
      else null
    end,
    nullif(trim(coalesce(new.raw_user_meta_data->>'surname', '')), '')
  ));
  if v_name is null or v_name = '' then
    v_name := coalesce(new.raw_user_meta_data->>'name', 'User');
  end if;

  insert into public.profiles (
    id, name, role,
    surname, given_name, middle_initial,
    house_no, street, brgy_purok,
    city_municipality, province, zip_code,
    plate_number, toda_location
  ) values (
    new.id,
    v_name,
    coalesce(new.raw_user_meta_data->>'role', 'passenger'),
    new.raw_user_meta_data->>'surname',
    new.raw_user_meta_data->>'given_name',
    new.raw_user_meta_data->>'middle_initial',
    new.raw_user_meta_data->>'house_no',
    new.raw_user_meta_data->>'street',
    new.raw_user_meta_data->>'brgy_purok',
    new.raw_user_meta_data->>'city_municipality',
    new.raw_user_meta_data->>'province',
    new.raw_user_meta_data->>'zip_code',
    new.raw_user_meta_data->>'plate_number',
    new.raw_user_meta_data->>'toda_location'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── STORAGE: profile photos ───────────────────────────────────
-- HOW TO APPLY:
--   1. Supabase Dashboard → SQL Editor → paste and run this block.
--   2. Go to Storage → Buckets and confirm "profile-photos" appears as PUBLIC.
--   3. Auth → Providers → Email → turn OFF "Confirm email" (required for
--      immediate session on signup so photos upload right away).
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,   -- 5 MB per file
  array['image/jpeg','image/jpg','image/png','image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg','image/jpg','image/png','image/webp'];

-- Drop all existing storage policies for this bucket before recreating
drop policy if exists "Public can view profile photos"  on storage.objects;
drop policy if exists "Users can upload own photos"     on storage.objects;
drop policy if exists "Users can update own photos"     on storage.objects;
drop policy if exists "Users can delete own photos"     on storage.objects;

-- Anyone can read (public bucket — URLs are shareable)
create policy "Public can view profile photos"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

-- Authenticated users can INSERT files under their own userId/ folder
create policy "Users can upload own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-photos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authenticated users can UPDATE (replace) their own files
create policy "Users can update own photos"
  on storage.objects for update
  using (
    bucket_id = 'profile-photos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authenticated users can DELETE their own files (needed for x-upsert to replace)
create policy "Users can delete own photos"
  on storage.objects for delete
  using (
    bucket_id = 'profile-photos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── DRIVER LOCATIONS ─────────────────────────────────────────
create table if not exists driver_locations (
  driver_id   uuid references profiles(id) on delete cascade primary key,
  lat         double precision not null,
  lng         double precision not null,
  is_available boolean default true,
  updated_at  timestamptz default now()
);

alter table driver_locations enable row level security;

drop policy if exists "Anyone can read driver locations"  on driver_locations;
drop policy if exists "Drivers can upsert own location"   on driver_locations;
drop policy if exists "Drivers can update own location"   on driver_locations;
drop policy if exists "Drivers can delete own location"   on driver_locations;

create policy "Anyone can read driver locations"
  on driver_locations for select using (true);
create policy "Drivers can upsert own location"
  on driver_locations for insert with check (auth.uid() = driver_id);
create policy "Drivers can update own location"
  on driver_locations for update using (auth.uid() = driver_id);
create policy "Drivers can delete own location"
  on driver_locations for delete using (auth.uid() = driver_id);

do $$ begin
  alter publication supabase_realtime add table driver_locations;
exception when duplicate_object then null;
end $$;

-- ── RIDE REQUESTS ─────────────────────────────────────────────
create table if not exists ride_requests (
  id           uuid default gen_random_uuid() primary key,
  passenger_id uuid references profiles(id) on delete set null,
  driver_id    uuid references profiles(id) on delete set null,
  status       text not null default 'pending'
               check (status in ('pending','accepted','declined','completed')),
  pickup_lat   double precision not null,
  pickup_lng   double precision not null,
  rating       smallint check (rating between 1 and 5),
  created_at   timestamptz default now()
);

alter table ride_requests enable row level security;

drop policy if exists "Passengers can insert ride requests" on ride_requests;
drop policy if exists "Involved users can read their rides" on ride_requests;
drop policy if exists "Admins can read all rides"           on ride_requests;
drop policy if exists "Driver can update ride status"       on ride_requests;

create policy "Passengers can insert ride requests"
  on ride_requests for insert with check (auth.uid() = passenger_id);

create policy "Involved users can read their rides"
  on ride_requests for select using (
    auth.uid() = passenger_id or auth.uid() = driver_id);

create policy "Admins can read all rides"
  on ride_requests for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Driver can update ride status"
  on ride_requests for update using (
    auth.uid() = driver_id or auth.uid() = passenger_id);

do $$ begin
  alter publication supabase_realtime add table ride_requests;
exception when duplicate_object then null;
end $$;

-- ── AUTO-RATE DRIVER ──────────────────────────────────────────
create or replace function update_driver_rating()
returns trigger as $$
begin
  if new.rating is not null then
    update profiles
    set average_rating = (
      select avg(rating)::numeric(3,2)
      from ride_requests
      where driver_id = new.driver_id and rating is not null
    )
    where id = new.driver_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_ride_rated on ride_requests;
create trigger on_ride_rated
  after update of rating on ride_requests
  for each row execute function update_driver_rating();

-- ── DESTINATION (added for A1 feature) ───────────────────────
alter table ride_requests add column if not exists destination_text text;

-- ── RIDE MESSAGES (canned quick-chat) ────────────────────────
create table if not exists ride_messages (
  id          uuid default gen_random_uuid() primary key,
  ride_id     uuid references ride_requests(id) on delete cascade not null,
  sender_id   uuid references profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('passenger', 'driver')),
  message     text not null,
  created_at  timestamptz default now()
);

alter table ride_messages enable row level security;

drop policy if exists "Ride parties can read messages" on ride_messages;
drop policy if exists "Ride parties can send messages" on ride_messages;

create policy "Ride parties can read messages"
  on ride_messages for select using (
    exists (
      select 1 from ride_requests r
      where r.id = ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    )
  );

create policy "Ride parties can send messages"
  on ride_messages for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from ride_requests r
      where r.id = ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    )
  );

do $$ begin
  alter publication supabase_realtime add table ride_messages;
exception when duplicate_object then null;
end $$;
