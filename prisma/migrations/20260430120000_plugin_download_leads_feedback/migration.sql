-- Plugin release, consented download lead, feedback, and unsubscribe workflow.
-- This migration is additive and keeps the older plugin_products/plugin_downloads tables intact.
create extension if not exists pgcrypto;

create table if not exists public.plugin_releases (
  id uuid primary key default gen_random_uuid(),
  plugin_slug text not null,
  plugin_name text not null,
  version text not null,
  file_url text not null,
  file_size_bytes bigint null,
  checksum_sha256 text null,
  is_active boolean not null default true,
  is_public boolean not null default true,
  release_notes text null,
  minimum_wp_version text null,
  minimum_wc_version text null,
  requires_php_version text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plugin_releases_slug_check check (plugin_slug in ('optivra-image-studio', 'optivra-gateway-rules')),
  constraint plugin_releases_slug_version_unique unique (plugin_slug, version)
);

create table if not exists public.plugin_download_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  name text null,
  store_url text null,
  company text null,
  country text null,
  plugin_slug text not null,
  first_downloaded_version text null,
  latest_downloaded_version text null,
  first_downloaded_at timestamptz not null default now(),
  last_downloaded_at timestamptz not null default now(),
  download_count integer not null default 0,
  connected_store_id text null,
  user_id uuid null,
  consent_product_updates boolean not null default true,
  consent_marketing boolean not null default false,
  consent_feedback boolean not null default true,
  consent_source text null,
  consented_at timestamptz null,
  unsubscribed_at timestamptz null,
  unsubscribe_token text unique not null default encode(gen_random_bytes(24), 'hex'),
  review_requested_at timestamptz null,
  feedback_requested_at timestamptz null,
  last_email_sent_at timestamptz null,
  lifecycle_status text not null default 'downloaded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plugin_download_leads_slug_check check (plugin_slug in ('optivra-image-studio', 'optivra-gateway-rules')),
  constraint plugin_download_leads_lifecycle_check check (lifecycle_status in ('downloaded', 'installed', 'connected', 'active', 'churn_risk', 'unsubscribed')),
  constraint plugin_download_leads_email_plugin_unique unique (email_normalized, plugin_slug)
);

create table if not exists public.plugin_download_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.plugin_download_leads(id) on delete set null,
  plugin_release_id uuid null references public.plugin_releases(id) on delete set null,
  plugin_slug text not null,
  plugin_version text not null,
  email_normalized text null,
  source_page text null,
  referrer text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_content text null,
  utm_term text null,
  ip_hash text null,
  user_agent text null,
  download_status text not null default 'started',
  created_at timestamptz not null default now(),
  constraint plugin_download_events_slug_check check (plugin_slug in ('optivra-image-studio', 'optivra-gateway-rules')),
  constraint plugin_download_events_status_check check (download_status in ('started', 'completed', 'failed'))
);

create table if not exists public.plugin_feedback (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.plugin_download_leads(id) on delete set null,
  plugin_slug text not null,
  plugin_version text null,
  email_normalized text null,
  rating integer null check (rating between 1 and 5),
  feedback_type text not null default 'general',
  message text null,
  permission_to_use_testimonial boolean not null default false,
  public_display_name text null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plugin_feedback_slug_check check (plugin_slug in ('optivra-image-studio', 'optivra-gateway-rules')),
  constraint plugin_feedback_type_check check (feedback_type in ('general', 'install_issue', 'feature_request', 'bug', 'rating', 'testimonial')),
  constraint plugin_feedback_status_check check (status in ('new', 'reviewed', 'actioned', 'dismissed'))
);

create table if not exists public.plugin_email_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.plugin_download_leads(id) on delete set null,
  plugin_slug text not null,
  email_normalized text not null,
  email_type text not null,
  provider text null,
  provider_message_id text null,
  status text not null default 'queued',
  skip_reason text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint plugin_email_events_slug_check check (plugin_slug in ('optivra-image-studio', 'optivra-gateway-rules')),
  constraint plugin_email_events_type_check check (email_type in ('download_link', 'setup_help', 'feedback_request', 'rating_request', 'update_notice', 'marketing')),
  constraint plugin_email_events_status_check check (status in ('queued', 'sent', 'failed', 'skipped'))
);

create table if not exists public.plugin_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.plugin_download_leads(id) on delete set null,
  email_normalized text not null,
  plugin_slug text null,
  unsubscribe_scope text not null default 'all_marketing',
  reason text null,
  created_at timestamptz not null default now(),
  constraint plugin_unsubscribes_slug_check check (plugin_slug is null or plugin_slug in ('optivra-image-studio', 'optivra-gateway-rules')),
  constraint plugin_unsubscribes_scope_check check (unsubscribe_scope in ('all_marketing', 'plugin_marketing', 'feedback_requests'))
);

create index if not exists plugin_releases_slug_version_idx on public.plugin_releases(plugin_slug, version);
create index if not exists plugin_releases_slug_active_idx on public.plugin_releases(plugin_slug, is_active);
create index if not exists plugin_download_leads_email_normalized_idx on public.plugin_download_leads(email_normalized);
create index if not exists plugin_download_leads_slug_lifecycle_idx on public.plugin_download_leads(plugin_slug, lifecycle_status);
create index if not exists plugin_download_leads_slug_last_downloaded_idx on public.plugin_download_leads(plugin_slug, last_downloaded_at desc);
create index if not exists plugin_download_events_slug_version_created_idx on public.plugin_download_events(plugin_slug, plugin_version, created_at desc);
create index if not exists plugin_download_events_utm_idx on public.plugin_download_events(utm_source, utm_campaign);
create index if not exists plugin_feedback_slug_rating_idx on public.plugin_feedback(plugin_slug, rating);
create index if not exists plugin_email_events_lead_type_idx on public.plugin_email_events(lead_id, email_type);
create index if not exists plugin_unsubscribes_email_idx on public.plugin_unsubscribes(email_normalized);

create or replace function public.set_plugin_workflow_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_plugin_releases_updated_at on public.plugin_releases;
create trigger set_plugin_releases_updated_at
before update on public.plugin_releases
for each row execute function public.set_plugin_workflow_updated_at();

drop trigger if exists set_plugin_download_leads_updated_at on public.plugin_download_leads;
create trigger set_plugin_download_leads_updated_at
before update on public.plugin_download_leads
for each row execute function public.set_plugin_workflow_updated_at();

drop trigger if exists set_plugin_feedback_updated_at on public.plugin_feedback;
create trigger set_plugin_feedback_updated_at
before update on public.plugin_feedback
for each row execute function public.set_plugin_workflow_updated_at();

insert into public.plugin_releases (
  plugin_slug,
  plugin_name,
  version,
  file_url,
  file_size_bytes,
  checksum_sha256,
  release_notes,
  minimum_wp_version,
  minimum_wc_version,
  requires_php_version
)
values
  (
    'optivra-image-studio',
    'Optivra Image Studio for WooCommerce',
    '1.0.0',
    '/downloads/optivra-image-studio-for-woocommerce-1.0.0.zip',
    62976,
    '546DB7F93B878FEDD7248B0C037918D23A853A87D9400D2F972D9CF693290634',
    'Initial public download for the WooCommerce Image Studio workflow.',
    '6.3',
    '8.0',
    '7.4'
  ),
  (
    'optivra-gateway-rules',
    'Optivra Gateway Rules for WooCommerce',
    '1.0.0',
    '/downloads/payment-gateway-rules-for-woocommerce-1.0.0.zip',
    181760,
    '33E82D8FABAC9002CB103CF8E210286709345C66C2965C03522BAA2B30AFFDF4',
    'Initial public download for payment gateway visibility rules.',
    '6.3',
    '8.0',
    '7.4'
  )
on conflict (plugin_slug, version) do update set
  plugin_name = excluded.plugin_name,
  file_url = excluded.file_url,
  file_size_bytes = excluded.file_size_bytes,
  checksum_sha256 = excluded.checksum_sha256,
  release_notes = excluded.release_notes,
  minimum_wp_version = excluded.minimum_wp_version,
  minimum_wc_version = excluded.minimum_wc_version,
  requires_php_version = excluded.requires_php_version,
  is_active = true,
  is_public = true,
  updated_at = now();

comment on table public.plugin_releases is 'Public Optivra plugin release metadata. Normal API responses do not expose private storage details.';
comment on table public.plugin_download_leads is 'One consent and lifecycle record per email/plugin relationship.';
comment on table public.plugin_download_events is 'One plugin download attempt/completion event with safe attribution fields.';
comment on table public.plugin_feedback is 'Private feedback, rating, testimonial permission, and install issue records.';
comment on table public.plugin_email_events is 'Transactional and follow-up email queue/audit records.';
comment on table public.plugin_unsubscribes is 'Unsubscribe records that do not require login.';
