-- Enable pg_cron + pg_net for edge function dispatch (follow-up / visit-reminder).
-- Applied remotely via MCP on project bfcssdogttmqeujgmxdf (2026-07-31).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
