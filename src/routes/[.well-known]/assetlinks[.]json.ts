import { createFileRoute } from "@tanstack/react-router";

// Digital Asset Links für die Android-TWA (Bubblewrap / .aab).
// Trage hier den SHA-256-Fingerprint deines Release-Keystores ein.
const SHA256_FINGERPRINTS: string[] = [
  // "AA:BB:CC:...:FF"
];

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          JSON.stringify([
            {
              relation: ["delegate_permission/common.handle_all_urls"],
              target: {
                namespace: "android_app",
                package_name: "app.lovable.nosypushup",
                sha256_cert_fingerprints: SHA256_FINGERPRINTS,
              },
            },
          ]),
          {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=300",
            },
          },
        ),
    },
  },
});
