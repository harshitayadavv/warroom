-- ═══════════════════════════════════════════════════════════
-- LOCATION: backend/supabase_schema.sql
-- ⚠️  Run this ENTIRE file in Supabase → SQL Editor → New Query → RUN
-- This drops old tables and recreates them cleanly
-- ═══════════════════════════════════════════════════════════

-- Drop everything old first
drop table if exists debate_turns        cascade;
drop table if exists checkpoints         cascade;
drop table if exists agent_personalities cascade;
drop table if exists debates             cascade;
drop function if exists update_updated_at cascade;

-- ── debates ───────────────────────────────────────────────────
create table debates (
  id                        uuid        primary key default gen_random_uuid(),
  user_id                   uuid        references auth.users(id) on delete cascade,
  topic                     text        not null,
  status                    text        not null default 'initializing',
  config                    jsonb       not null default '{}',
  consensus_score           float       not null default 0,
  current_round             int         not null default 0,
  max_rounds                int         not null default 5,
  winner_role               text,
  summary                   text,
  tags                      text[]      default '{}',
  personal_context_detected boolean     default false,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ── debate_turns ──────────────────────────────────────────────
create table debate_turns (
  id           uuid        primary key default gen_random_uuid(),
  debate_id    uuid        not null references debates(id) on delete cascade,
  round        int         not null,
  agent_role   text        not null,
  agent_name   text        not null,
  content      text        not null,
  tool_calls   jsonb       default '[]',
  score        jsonb       default '{}',
  embedding    float[],
  is_interrupt boolean     default false,
  created_at   timestamptz default now()
);

-- ── checkpoints ───────────────────────────────────────────────
create table checkpoints (
  id             uuid        primary key default gen_random_uuid(),
  debate_id      uuid        not null references debates(id) on delete cascade,
  round          int         not null,
  state_snapshot jsonb       not null default '{}',
  label          text,
  created_at     timestamptz default now()
);

-- ── agent_personalities ───────────────────────────────────────
create table agent_personalities (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        references auth.users(id) on delete cascade,
  name            text        not null,
  role            text        not null,
  system_prompt   text,
  temperament     text        default 'balanced',
  expertise_level int         default 3,
  model           text        default 'llama-3.3-70b-versatile',
  temperature     float       default 0.7,
  is_default      boolean     default false,
  created_at      timestamptz default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index idx_debates_user_id    on debates(user_id);
create index idx_debates_status     on debates(status);
create index idx_debates_created    on debates(created_at desc);
create index idx_turns_debate_id    on debate_turns(debate_id);
create index idx_checkpoints_debate on checkpoints(debate_id, round);

-- ── Auto updated_at ───────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger debates_updated_at
  before update on debates
  for each row execute function update_updated_at();

-- ── Row Level Security ─────────────────────────────────────────
alter table debates             enable row level security;
alter table debate_turns        enable row level security;
alter table checkpoints         enable row level security;
alter table agent_personalities enable row level security;

-- Users see only their own data
create policy "own debates"
  on debates for all
  using (auth.uid() = user_id);

create policy "own turns"
  on debate_turns for all
  using (debate_id in (select id from debates where user_id = auth.uid()));

create policy "own checkpoints"
  on checkpoints for all
  using (debate_id in (select id from debates where user_id = auth.uid()));

create policy "own or default personalities"
  on agent_personalities for all
  using (auth.uid() = user_id or is_default = true);

-- Backend service role bypasses RLS (used by backend with SERVICE_KEY)
-- No extra config needed — service key bypasses RLS automatically

-- ── Seed default agent personalities ──────────────────────────
insert into agent_personalities
  (name, role, temperament, expertise_level, model, temperature, is_default)
values
  ('AXIOM',   'proponent',    'analytical', 4, 'llama-3.3-70b-versatile', 0.7, true),
  ('REFUTE',  'opponent',     'aggressive', 4, 'llama-3.3-70b-versatile', 0.8, true),
  ('VERITAS', 'fact_checker', 'balanced',   5, 'llama-3.1-8b-instant',    0.2, true),
  ('ARBITER', 'moderator',    'diplomatic', 5, 'llama-3.3-70b-versatile', 0.3, true);