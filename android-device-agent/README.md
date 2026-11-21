# Mira Android Device Agent – Phase 6 foundation

This is a separate native Android companion, not the Alo PWA/TWA.

## Current scope

- Pairs with the existing Mira Gateway using a one-time six-digit code.
- Creates an RSA-2048 device key in Android Keystore; the private key is non-exportable.
- Encrypts the gateway device token with an Android Keystore AES-GCM key before storing it.
- Maintains an outbound WSS connection from a visible foreground service.
- Shows a persistent notification with an explicit disconnect action.
- Handles heartbeat, Not-Aus and gateway revocation.
- Rejects all remote action requests as `nicht-implementiert` until Android-specific actions have been designed and reviewed.

## Security boundaries

- HTTPS is required for pairing; the WebSocket uses WSS.
- No inbound ports, shell, AccessibilityService, screen capture, file access or remote input.
- Pairing codes are one-time and short-lived on the gateway.
- The service only starts after a user action in the app.
- The user can disconnect from the notification at any time.

## Build

Open this directory in Android Studio, or use the repository's Android Agent workflow. Minimum Android version: 8.0 (API 26).

This foundation is not a production-ready remote-control client. Device pairing and online presence can be tested; remote actions intentionally remain disabled.
