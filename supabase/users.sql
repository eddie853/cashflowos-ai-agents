-- ============================================================
-- USERS & ROLES — personal logins for your team (Admin / Sales / Staff).
-- Paste this WHOLE block into the Supabase SQL Editor and click Run once.
-- Safe to re-run: create-if-not-exists only, never deletes a row.
-- Passwords are NOT stored here — Supabase Auth (auth.users) keeps them hashed.
-- ============================================================

-- ------------------------------------------------------------
-- 7) profiles — one row per person who may log in. Role + on/off switch.
--    role: admin (everything) | sales (leads, customers, tasks, content)
--          | staff (tasks, content). active=false locks them out instantly.
-- ------------------------------------------------------------
create table if not exists profiles (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null unique,
  name        text,
  role        text        not null default 'staff' check (role in ('admin', 'sales', 'staff')),
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid
);

-- ------------------------------------------------------------
-- 8) auth_tokens — one-time invite / reset-password links. Only the SHA-256
--    HASH of the link token is stored, so a database leak can't be replayed.
-- ------------------------------------------------------------
create table if not exists auth_tokens (
  id          bigint      generated always as identity primary key,
  token_hash  text        not null unique,
  user_id     uuid        not null references profiles(user_id) on delete cascade,
  purpose     text        not null check (purpose in ('invite', 'reset')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid
);

-- ------------------------------------------------------------
-- 9) activity_log — who did what, when. Written by the app on every login,
--    record add/edit, approval and admin change. Never edited or deleted.
-- ------------------------------------------------------------
create table if not exists activity_log (
  id          bigint      generated always as identity primary key,
  at          timestamptz not null default now(),
  user_id     uuid,
  user_email  text,
  action      text        not null,
  entity      text,
  entity_id   text,
  detail      jsonb       not null default '{}'::jsonb
);
create index if not exists activity_log_at_idx on activity_log (at desc);

-- Server-side only, like every other table: RLS on, no policies.
alter table profiles     enable row level security;
alter table auth_tokens  enable row level security;
alter table activity_log enable row level security;
