# Mira Device Control – Cloudflare Gateway port

This package is an isolated Cloudflare Workers + Durable Objects implementation track for the existing Node gateway in `../gateway`. It does not replace or modify the Node gateway.

## Current state: scaffold only

- `GET /healthz` reports the Worker scaffold status.
- A SQLite-backed Durable Object class is registered for future per-device session/state ownership.
- Device pairing, WebSocket authentication, control routes, action dispatch, screen sessions, revocation, and emergency-stop behavior are deliberately **not enabled** yet. Those routes return HTTP 503 rather than accepting incomplete or unauthenticated traffic.

## Local checks

```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Security and migration constraints

- Do not deploy this scaffold for device use.
- Do not add secrets to `wrangler.toml`; set them with Wrangler secrets after the implementation and tests are complete.
- The existing gateway's security rules must be ported before enabling routes: one-time six-digit pairing codes with TTL and rate limiting, salted token hashes, owner checks, permission policy, action confirmation, emergency stop, revoke semantics, heartbeat handling, message size limits, and privacy-minimized action logs.
- Durable Object storage is separate from Alo's application database. No Supabase schema, migration, or existing Alo database is touched by this package.
- Free-plan limits and deployment eligibility must be checked in the Cloudflare dashboard before production use.

## Source of truth

The Node implementation under `../gateway/src` and `../docs/device-control-gateway-spec.md` remain the behavioral reference until parity tests prove otherwise.
