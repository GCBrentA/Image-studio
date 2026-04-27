-- Internal analytics and admin role support.

ALTER TABLE public.optivra_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

ALTER TABLE public.connected_sites
  ADD COLUMN IF NOT EXISTS wordpress_version text NULL,
  ADD COLUMN IF NOT EXISTS php_version text NULL;

CREATE TABLE IF NOT EXISTS public.plugin_events (
  id text PRIMARY KEY,
  account_id text NULL,
  store_id text NULL,
  canonical_domain text NULL,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'wordpress_plugin',
  plugin_version text NULL,
  wordpress_version text NULL,
  woocommerce_version text NULL,
  php_version text NULL,
  plan text NULL,
  credits_remaining integer NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plugin_events_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.optivra_users(id) ON DELETE SET NULL,
  CONSTRAINT plugin_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.connected_sites(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS plugin_events_event_type_created_at_idx ON public.plugin_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS plugin_events_store_id_created_at_idx ON public.plugin_events(store_id, created_at);
CREATE INDEX IF NOT EXISTS plugin_events_account_id_created_at_idx ON public.plugin_events(account_id, created_at);
CREATE INDEX IF NOT EXISTS plugin_events_canonical_domain_idx ON public.plugin_events(canonical_domain);
