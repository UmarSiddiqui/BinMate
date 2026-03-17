## Handoff — 2026-03-17 (scraper phase complete)
**From:** Claude Code
**Completed in this session:**
- All 29 Perth council scrapers built, tested, seeded into Supabase, and committed
- 7 new seed files created and run: Bassendean, Claremont, Cottesloe, EastFremantle, Kwinana, Mundaring, Serpentine-Jarrahdale
- All 29 scrapers wired into `SCRAPER_REGISTRY`
- Subiaco scraper stability fixes (live-data drift in assertions)
- PLAN.md, COUNCILS.md, HANDOFF.md fully updated to reflect actual state

**Commit:** `f0bb7af` — "Complete all 29 Perth council scrapers; seed all zones into Supabase"

**Current state — backend:**
- ✅ All 29 council scrapers complete (scraper + tests + seed + registry)
- ✅ All zones seeded into Supabase
- ✅ Phase 2.1 API routes complete (register-address, schedule, push-token, revenuecat webhook, health)
- ✅ Notification engine implemented (cron at 09:00 UTC / 17:00 AWST)
- ⚠️  APNs still mocked — blocked on Apple Developer account
- ❌ Not yet deployed to Render

**Current state — iOS:**
- ✅ All Phase 3.1–3.10 complete (all screens, WidgetKit, notifications, paywall, accessibility)
- ❌ Not yet on TestFlight — blocked on Apple Developer account + Render deployment

**Next tasks (in order):**
1. **Deploy to Render** — requires GitHub repo to be connected to Render, env vars configured, `prisma migrate deploy` run on production
   - `render.yaml` blueprint is ready
   - All required env vars are in `backend/.env` (copy to Render dashboard)
   - After deploy: verify `GET /api/v1/health` returns `{"status":"ok","db":"ok"}`
2. **Apple Developer account** ($149 AUD/year) — unblocks:
   - Real APNs push notifications (replace mock in `src/services/notifications.ts`)
   - TestFlight upload
   - App Store submission
3. **TestFlight beta** — upload build, recruit 50+ Perth beta testers
4. **App Store submission** — screenshots + review notes ready in `docs/APP_STORE.md`

**Known issues / watch-outs:**
- Live council APIs can shift weekday/week-token outcomes over time — scraper tests assert invariant zone shape, not pinned day values (correct behaviour)
- Stirling scraper returns informative error for major arterial road addresses (Nominatim road centroid, not residential parcel) — expected, residential addresses work fine
- Kwinana zones: seed covers 20 common combinations; edge-case zone codes will be upserted on first encounter by the address service
- Claremont ward bundle URL (`796.2182434058107d55e5c6.js`) will change when council deploys a new JS build — monitor and update `WARD_BUNDLE_URL` in `claremont.ts` if health check fails
