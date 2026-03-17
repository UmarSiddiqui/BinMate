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
- ✅ **DEPLOYED to Render** — `https://binmate-api.onrender.com` — all systems operational
- ✅ Health check verified: `GET /api/v1/health` → `{"status":"ok","db":"ok","env":"production"}`
- ⚠️  APNs still mocked — blocked on Apple Developer account (cannot send real push notifications until APNs configured)

**Current state — iOS:**
- ✅ All Phase 3.1–3.10 complete (all screens, WidgetKit, notifications, paywall, accessibility)
- ❌ Not yet on TestFlight — blocked on Apple Developer account + real APNs from backend

**Next tasks (in order):**
1. **✅ DONE** — Backend deployed to Render (2026-03-17 15:38:27 UTC)
2. **Apple Developer account** ($149 AUD/year) — unblocks **all remaining work**:
   - **Real APNs push notifications:** Replace mock in `backend/src/services/notifications.ts` with actual FCM → APNs relay
   - **APNs certificate + key:** Generate in App Store Connect, upload to backend config
   - **TestFlight upload:** Use `xcode build -scheme BinMate -archivePath ... -exportOptionsPlist` + `xcrun altool --upload-app ...`
   - **App Store submission:** Screenshots + review notes ready in `docs/APP_STORE.md`
3. **TestFlight beta** — once Apple account + real APNs working:
   - Build + archive iOS app
   - Upload via Xcode → Organizer or Transporter
   - Invite 50+ Perth beta testers (use TestFlight email/link)
   - Collect feedback on notification reliability, address resolution UX
4. **App Store submission** — after TestFlight review cycle stabilizes (5–14 days):
   - Submit via App Store Connect
   - Add screenshots, description, privacy policy link
   - App Review (typically 24–48 hours)
   - Live on App Store

**Known issues / watch-outs:**
- Live council APIs can shift weekday/week-token outcomes over time — scraper tests assert invariant zone shape, not pinned day values (correct behaviour)
- Stirling scraper returns informative error for major arterial road addresses (Nominatim road centroid, not residential parcel) — expected, residential addresses work fine
- Kwinana zones: seed covers 20 common combinations; edge-case zone codes will be upserted on first encounter by the address service
- Claremont ward bundle URL (`796.2182434058107d55e5c6.js`) will change when council deploys a new JS build — monitor and update `WARD_BUNDLE_URL` in `claremont.ts` if health check fails
