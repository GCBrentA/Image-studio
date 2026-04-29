CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "event_source" TEXT NOT NULL DEFAULT 'website',
  "route_group" TEXT,
  "page_path" TEXT,
  "clean_url" TEXT,
  "session_engagement_id" TEXT,
  "visitor_type" TEXT,
  "referrer_domain" TEXT,
  "first_touch_source" TEXT,
  "first_touch_medium" TEXT,
  "first_touch_campaign" TEXT,
  "last_touch_source" TEXT,
  "last_touch_medium" TEXT,
  "last_touch_campaign" TEXT,
  "landing_page" TEXT,
  "entry_route_group" TEXT,
  "funnel_stage" TEXT,
  "product_slug" TEXT,
  "plugin_slug" TEXT,
  "plan_name" TEXT,
  "content_slug" TEXT,
  "cta_location" TEXT,
  "environment" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_events_event_name_created_at_idx" ON "analytics_events"("event_name", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_route_group_created_at_idx" ON "analytics_events"("route_group", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_page_path_created_at_idx" ON "analytics_events"("page_path", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_session_engagement_id_created_at_idx" ON "analytics_events"("session_engagement_id", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_first_touch_source_created_at_idx" ON "analytics_events"("first_touch_source", "created_at");

