---
name: Node 20 Supabase SSR WebSocket Fix
description: Why the ws package is needed and how it's wired into the Supabase client.
---

## Problem
Node.js 20 lacks native WebSocket support. Supabase Realtime throws on SSR startup:
"Node.js 20 detected without native WebSocket support."

## Fix
Install `ws` and `@types/ws`, then in `src/integrations/supabase/client.ts`:
```ts
const WebSocketImpl =
  typeof WebSocket !== 'undefined'
    ? WebSocket
    : (await import('ws').then((m) => m.default)) as unknown as typeof WebSocket;

// pass to createClient:
realtime: { transport: WebSocketImpl }
```

**Why:** The top-level await import is valid in ESM modules (this project uses `"type": "module"`).

## Remove when upgrading to Node 22
Node 22 ships native WebSocket — remove the `ws` import and the `realtime.transport` option entirely.
Relevant: `.replit` modules line, `package.json` ws dependency, `src/integrations/supabase/client.ts`.
