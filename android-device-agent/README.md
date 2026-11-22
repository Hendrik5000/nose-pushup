# Mira Android Device Agent – Phase 6 foundation

This is a separate native Android companion, not the Alo PWA/TWA.

## Current scope

- Pairs with the Mira Gateway using a one-time six-digit code.
- Creates an RSA-2048 device key in Android Keystore; the private key is non-exportable.
- Encrypts the gateway device token with an Android Keystore AES-GCM key before storing it.
- Maintains an outbound WSS connection from a visible foreground service.
- Requires app notifications to be enabled before pairing or connecting, so the persistent connection indicator cannot be silently hidden by a denied notification permission.
- Shows a persistent notification with an explicit disconnect action.
- Handles heartbeat, Not-Aus and gateway revocation.
- Implements the limited Android action set: `status.ping`, `status.info`, `audio.lautstaerke` and `audio.stummschalten`.
- Rejects unsupported desktop-oriented tools as `nicht-implementiert`.

## Security boundaries

- HTTPS is required for pairing; the WebSocket uses WSS.
- Gateway URL validation rejects credentials, paths, query strings and fragments.
- No inbound ports, shell, AccessibilityService, arbitrary file access, screen capture or remote input.
- Pairing codes are one-time and short-lived on the gateway.
- The service only starts after a user action in the app.
- The user can disconnect from the notification at any time.
- The device token is encrypted at rest with an Android Keystore AES-GCM key.
- The gateway validates the device token on every WebSocket handshake; the registered RSA public-key fingerprint is available for identity display but is not currently used as a challenge-response factor.

## Build and tests

The repository workflow runs Android unit tests and creates a debug APK artifact for every change under this directory.

Run locally:

```bash
gradle :app:testDebugUnitTest :app:assembleDebug --no-daemon
```

Minimum Android version: 8.0 (API 26). This is an early companion app; production rollout still requires end-to-end pairing, owner-scoped emergency-stop verification, permissions/UI integration and real-device acceptance tests.
