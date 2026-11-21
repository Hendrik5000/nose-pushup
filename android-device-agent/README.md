# Mira Android Device Agent – Phase 6 foundation

This is a separate native Android companion, not the Alo PWA/TWA.

## Current scope

- Pairs with the existing Mira Gateway using a one-time six-digit code.
- Creates an RSA-2048 device key in Android Keystore; the private key is non-exportable.
- Encrypts the gateway device token with an Android Keystore AES-GCM key before storing it.
- Maintains an outbound WSS connection from a visible foreground service.
- Requires app notifications to be enabled before pairing or connecting, so the persistent connection indicator cannot be silently hidden by a denied notification permission.
- Shows a persistent notification with an explicit disconnect action.
- Handles heartbeat, Not-Aus and gateway revocation.
- Executes only the two explicitly implemented read-only requests: `status.ping` and `status.info`. The latter returns only manufacturer/model and Android version when requested. All unknown, malformed and state-changing requests remain blocked.

## Security boundaries

- HTTPS is required for pairing; the WebSocket uses WSS.
- Gateway URL validation rejects credentials, paths, query strings and fragments.
- No inbound ports, shell, AccessibilityService, screen capture, file access or remote input.
- Pairing codes are one-time and short-lived on the gateway.
- The service only starts after a user action in the app.
- The user can disconnect from the notification at any time.

## Build and tests

Open this directory in Android Studio, or use the repository's Android Agent workflow. Minimum Android version: 8.0 (API 26).

Run:

```bash
gradle :app:testDebugUnitTest :app:assembleDebug --no-daemon
```

The URL-validation tests cover HTTPS-only operation and reject paths, credentials, query strings and fragments.

This foundation is not a production-ready remote-control client. Device pairing and online presence can be tested; remote actions intentionally remain disabled.


## Reconnect-Schutz (Phase 6 follow-up)

The foreground service assigns a monotonically increasing generation to each
connection attempt. Callbacks from replaced sockets and delayed reconnect tasks
are ignored, and repeated service starts do not create parallel connections.
This protects connection state only; Android remote actions remain disabled.


## Android action allowlist (2026-11-21)

- `status.ping`: returns a simple reachability acknowledgement.
- `status.info`: returns manufacturer/model and Android version only when explicitly requested.
- Every other action, including app launch, input, files, settings and shutdown, remains `nicht-implementiert`.
- The agent independently validates request ID, tool ID, argument object and confirmation flag. The gateway permission check remains mandatory as a separate layer.
- A critical shutdown request without the Mira confirmation flag returns `bestaetigung-erforderlich`; even with that flag, shutdown is still not implemented and cannot execute.
- No shell, AccessibilityService, screen capture, file access or remote input was added.
