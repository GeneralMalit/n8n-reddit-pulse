create extension if not exists pgcrypto;

create table if not exists public.app_config (
  singleton boolean primary key default true check (singleton),
  gemini_api_key text not null,
  n8n_webhook_url text not null,
  default_fetch_limit integer not null default 10 check (default_fetch_limit >= 5),
  default_digest_size integer not null default 4 check (default_digest_size >= 1),
  summarization_model text not null default 'gemma-4-31b-it' check (summarization_model in ('gemini-3-flash-preview', 'gemma-4-31b-it', 'gemma-3-27b-it', 'gemini-2.5-flash')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subreddit_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  enabled boolean not null default true,
  process_images boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  source_listing text not null default 'hot',
  triggered_at timestamptz not null default now(),
  completed_at timestamptz,
  total_subreddits integer not null default 0 check (total_subreddits >= 0),
  notes text
);

create table if not exists public.run_digests (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  subreddit_config_id uuid references public.subreddit_configs(id) on delete set null,
  subreddit_name text not null,
  headline text not null,
  summary text not null,
  image_context_used boolean not null default false,
  source_count integer not null default 0 check (source_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.digest_sources (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.run_digests(id) on delete cascade,
  title text not null,
  author text not null,
  permalink text not null,
  score integer not null default 0,
  comment_count integer not null default 0,
  preview_image_url text,
  is_image_post boolean not null default false,
  sort_rank integer not null default 1 check (sort_rank >= 1),
  created_at timestamptz not null default now()
);

create index if not exists idx_subreddit_configs_enabled
  on public.subreddit_configs (enabled);

create index if not exists idx_runs_triggered_at
  on public.runs (triggered_at desc);

create index if not exists idx_run_digests_run_id
  on public.run_digests (run_id);

create index if not exists idx_digest_sources_digest_id
  on public.digest_sources (digest_id, sort_rank);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_config_updated_at on public.app_config;
create trigger set_app_config_updated_at
before update on public.app_config
for each row
execute function public.set_updated_at();

drop trigger if exists set_subreddit_configs_updated_at on public.subreddit_configs;
create trigger set_subreddit_configs_updated_at
before update on public.subreddit_configs
for each row
execute function public.set_updated_at();

alter table public.app_config disable row level security;
alter table public.subreddit_configs disable row level security;
alter table public.runs disable row level security;
alter table public.run_digests disable row level security;
alter table public.digest_sources disable row level security;
