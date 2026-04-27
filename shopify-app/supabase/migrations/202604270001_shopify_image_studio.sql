create extension if not exists "pgcrypto";

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  shop_domain text unique not null,
  access_token_encrypted text not null,
  scopes text,
  installed_at timestamptz,
  uninstalled_at timestamptz,
  plan text default 'free_beta',
  credits_remaining integer default 50,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists shopify_products_cache (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade,
  shopify_product_id text not null,
  title text,
  handle text,
  status text,
  image_count integer default 0,
  main_image_url text,
  main_media_id text,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(shop_id, shopify_product_id)
);

create table if not exists image_jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade,
  shopify_product_id text not null,
  shopify_media_id text,
  source_image_url text not null,
  generated_image_url text,
  prompt text,
  mode text,
  status text default 'queued',
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists image_job_events (
  id uuid primary key default gen_random_uuid(),
  image_job_id uuid references image_jobs(id) on delete cascade,
  event_type text,
  event_payload jsonb,
  created_at timestamptz default now()
);

create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade unique,
  background_mode text default 'pure_white',
  default_prompt text,
  preserve_product boolean default true,
  auto_crop boolean default true,
  auto_center boolean default true,
  replacement_mode text default 'manual_approval',
  delete_data_on_uninstall boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists credit_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade,
  image_job_id uuid references image_jobs(id) on delete set null,
  amount integer not null,
  reason text,
  created_at timestamptz default now()
);

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade,
  shopify_charge_id text,
  plan text,
  status text,
  created_at timestamptz default now()
);

create index if not exists shopify_products_cache_shop_id_idx on shopify_products_cache(shop_id);
create index if not exists image_jobs_shop_status_idx on image_jobs(shop_id, status);
create index if not exists image_job_events_job_idx on image_job_events(image_job_id, created_at);
create index if not exists credit_events_shop_idx on credit_events(shop_id, created_at);
create index if not exists billing_events_shop_idx on billing_events(shop_id, created_at);
