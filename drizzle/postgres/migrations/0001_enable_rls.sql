-- Application role that respects RLS. The postgres superuser bypasses RLS unless
-- the session assumes this role via SET LOCAL ROLE in withUserRlsScope.
CREATE ROLE langtutor_app NOLOGIN NOINHERIT NOREPLICATION NOCREATEDB NOCREATEROLE;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO langtutor_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO langtutor_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO langtutor_app;--> statement-breakpoint
GRANT langtutor_app TO postgres;--> statement-breakpoint
ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profile" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "profile_isolate_by_user" ON "profile"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));--> statement-breakpoint
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cards" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cards_isolate_by_user" ON "cards"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));--> statement-breakpoint
ALTER TABLE "error_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "error_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "error_events_isolate_by_user" ON "error_events"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));--> statement-breakpoint
ALTER TABLE "weakness" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "weakness" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "weakness_isolate_by_user" ON "weakness"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));--> statement-breakpoint
ALTER TABLE "gamification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gamification" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "gamification_isolate_by_user" ON "gamification"
  FOR ALL
  USING ("user_id"::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK ("user_id"::text = current_setting('request.jwt.claim.sub', true));
