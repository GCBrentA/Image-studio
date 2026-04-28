-- Plugin download lead capture, download tracking, and public reviews.
create extension if not exists pgcrypto;

create table if not exists public.plugin_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  current_version text not null,
  download_file_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.plugin_leads (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text null,
  marketing_consent boolean not null default false,
  privacy_accepted boolean not null default false,
  source text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  referrer text null,
  ip_hash text null,
  user_agent_hash text null,
  created_at timestamptz not null default now()
);

create table if not exists public.plugin_downloads (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugin_products(id) on delete cascade,
  lead_id uuid not null references public.plugin_leads(id) on delete cascade,
  version text not null,
  token text unique not null,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  source text null,
  ip_hash text null,
  user_agent_hash text null,
  constraint plugin_downloads_status_check check (status in ('requested', 'started', 'completed', 'failed'))
);

create table if not exists public.plugin_reviews (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugin_products(id) on delete cascade,
  lead_id uuid null references public.plugin_leads(id) on delete set null,
  rating integer not null,
  title text not null,
  body text not null,
  display_name text not null,
  verified_download boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  constraint plugin_reviews_rating_check check (rating between 1 and 5),
  constraint plugin_reviews_status_check check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists plugin_leads_email_idx on public.plugin_leads(email);
create index if not exists plugin_leads_source_idx on public.plugin_leads(source);
create index if not exists plugin_downloads_plugin_id_idx on public.plugin_downloads(plugin_id);
create index if not exists plugin_downloads_lead_id_idx on public.plugin_downloads(lead_id);
create index if not exists plugin_downloads_status_idx on public.plugin_downloads(status);
create index if not exists plugin_downloads_requested_at_idx on public.plugin_downloads(requested_at);
create index if not exists plugin_reviews_plugin_id_idx on public.plugin_reviews(plugin_id);
create index if not exists plugin_reviews_lead_id_idx on public.plugin_reviews(lead_id);
create index if not exists plugin_reviews_status_idx on public.plugin_reviews(status);
create index if not exists plugin_reviews_rating_idx on public.plugin_reviews(rating);

insert into public.plugin_products (slug, name, description, current_version, download_file_path, is_active)
values
  (
    'optivra-image-studio-for-woocommerce',
    'Optivra Image Studio for WooCommerce',
    'AI-powered product image optimisation, review workflow, and SEO metadata for WooCommerce.',
    '1.0.0',
    'public/site/downloads/optivra-image-studio-for-woocommerce-1.0.0.zip',
    true
  ),
  (
    'payment-gateway-rules-for-woocommerce',
    'Payment Gateway Rules for WooCommerce',
    'Show or hide WooCommerce payment gateways based on billing country, shipping country, currency, cart totals, and checkout rules.',
    '1.0.0',
    'public/site/downloads/payment-gateway-rules-for-woocommerce-1.0.0.zip',
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  current_version = excluded.current_version,
  download_file_path = excluded.download_file_path,
  is_active = excluded.is_active;
