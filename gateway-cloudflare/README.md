# Mira Device Control – Cloudflare Gateway port

Isolated Cloudflare Workers + Durable Objects migration track for the Node gateway in `../gateway`. The existing Node implementation is unchanged.

## Implemented preview scope
- `GET /healthz` health check.
- `POST /v1/control/pairing-code`: admin bearer-token protected, UUID owner validation, one-time six-digit code with a maximum five-minute TTL.
- `POST /v1/pair`: strict request validation, RSA SPKI import validation, five failed attempts per connecting IP per ten-minute window, single-use pairing code, per-device random token, salted SHA-256 token hash, SHA-256 public-key fingerprint, and sanitized device records in Durable Object storage.
- `GET /v1/control/devices?userId=...`: admin bearer-token protected and owner-scoped device listing.
- Unknown control routes and device WebSocket traffic remain closed with HTTP 503 until fully ported and tested.

## Local checks
```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Safety
Not production-ready and not enabled for device use. WebSocket handshake, token authentication, heartbeat, permissions, action routing, revocation, screen sessions, emergency stop and full action-log API are still pending. Do not deploy this preview. No Supabase/Alo application database is touched; Durable Object storage is isolated from it. No Cloudflare resources have been deployed by this change.
