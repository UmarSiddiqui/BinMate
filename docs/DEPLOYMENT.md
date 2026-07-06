# Deployment

## Backend

### Render blueprint
- Root file: [render.yaml](/Users/umarsiddiqui/Desktop/BinMate/render.yaml)
- Service root: `backend/`
- Build command: `npm ci && npm run db:generate && npm run build`
- Start command: `npm run start:render`
- Health check: `GET /api/v1/health`

### Required environment variables
- `DATABASE_URL`
- `DIRECT_URL`
- `CRON_SECRET`
- `GEOCODING_CONTACT_EMAIL`

### Optional environment variables
- `ADMIN_PASSWORD`
- `SENTRY_DSN`
- `FCM_SERVICE_ACCOUNT_KEY`

### Deploy steps
1. Push the repo to GitHub.
2. In Render, create a new Blueprint service from the repo.
3. Set the required environment variables from [backend/.env.example](/Users/umarsiddiqui/Desktop/BinMate/backend/.env.example).
4. Confirm Render detects `backend/` as the service root.
5. Deploy once. Render will run `prisma migrate deploy` on startup before launching the API.
6. After first boot, confirm [api/v1/health](/Users/umarsiddiqui/Desktop/BinMate/backend/src/app.ts) reports `db: "ok"` and includes `deployment.gitSha`.

## Supabase

### Connection strings
- `DATABASE_URL`: transaction pooler, port `6543`
- `DIRECT_URL`: session pooler, port `5432`

### Production migration rule
- Never run `prisma migrate dev` against production.
- Production deploys should only use `npm run db:deploy`.

## Smoke Test

Assume `BASE_URL=https://your-render-service.onrender.com`.

### Health
```bash
curl --fail "$BASE_URL/api/v1/health"
```

Expected:
- `status` is `"ok"`
- `db` is `"ok"`
- `deployment.gitSha` is not `"local"`

### Admin auth guard
```bash
curl -i "$BASE_URL/admin"
```

Expected:
- `401 Unauthorized` if `ADMIN_PASSWORD` is set
- `503` if admin is intentionally disabled

### Cron auth guard
```bash
curl -i -X POST "$BASE_URL/api/v1/cron/trigger-notifications"
```

Expected:
- `401 Unauthorized`

### Cron trigger
```bash
curl --fail -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/v1/cron/trigger-notifications"
```

Expected:
- `{ "ok": true }`

### Address registration
```bash
curl --fail -X POST \
  -H "Content-Type: application/json" \
  -d '{"address":"1 Sandgate Street SOUTH PERTH WA 6151"}' \
  "$BASE_URL/api/v1/register-address"
```

Expected:
- `zoneId` present
- `councilName` present
- `nextCollections` array present

## iOS

### TestFlight base URL
1. Copy [Config.example.xcconfig](/Users/umarsiddiqui/Desktop/BinMate/ios/BinMate/Resources/Config.example.xcconfig) to `Config.xcconfig`.
2. Set `API_BASE_URL` to the Render HTTPS URL.
3. Set `SENTRY_DSN` if enabled.

### Pre-TestFlight check
- The app must not point at `http://localhost:3000`.
- The backend must be reachable over HTTPS.
