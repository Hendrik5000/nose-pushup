
/**
 * Konfiguration des Device Control Gateways (Phase 4).
 * Alles über Umgebungsvariablen, siehe gateway/README.md.
 */
export type GatewayConfig = {
  port: number;
  host: string;
  dataDir: string;
  adminToken: string;
  adminTokenGenerated: boolean;
  pairOnLocalhostOnly: boolean;
  allowPlainHttp: boolean;
  trustProxy: boolean;
  pairingCodeTtlMs: number;
  pairingMaxFailures: number;
  pairingFailureWindowMs: number;
  handshakeTimeoutMs: number;
  heartbeatTimeoutMs: number;
  maxMessageBytes: number;
  screenMaxFramesPerSecond: number;
  actionTimeoutMs: number;
  actionLogMaxEntries: number;
};

export function generateAdminToken(): string {
  const bytes = new Uint8Array(33);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const cryptoObj = globalThis.crypto;

function readInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function readBool(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

export function loadConfig(env: Record<string, string | undefined> = {}): GatewayConfig {
  const adminToken = env.MIRA_GATEWAY_ADMIN_TOKEN;
  const generated = adminToken === undefined || adminToken.trim() === '';
  return {
    port: readInt(env.MIRA_GATEWAY_PORT, 8787),
    host: env.MIRA_GATEWAY_HOST ?? '127.0.0.1',
    dataDir: env.MIRA_GATEWAY_DATA_DIR ?? './data',
    adminToken: generated ? generateAdminToken() : adminToken.trim(),
    adminTokenGenerated: generated,
    pairOnLocalhostOnly: !readBool(env.MIRA_GATEWAY_PAIR_REMOTE_ALLOWED),
    allowPlainHttp: readBool(env.MIRA_GATEWAY_ALLOW_PLAIN_HTTP),
    trustProxy: readBool(env.MIRA_GATEWAY_TRUST_PROXY),
    pairingCodeTtlMs: readInt(env.MIRA_GATEWAY_PAIRING_TTL_MS, 5 * 60_000),
    pairingMaxFailures: readInt(env.MIRA_GATEWAY_PAIRING_MAX_FAILURES, 5),
    pairingFailureWindowMs: readInt(env.MIRA_GATEWAY_PAIRING_FAILURE_WINDOW_MS, 10 * 60_000),
    handshakeTimeoutMs: readInt(env.MIRA_GATEWAY_HANDSHAKE_TIMEOUT_MS, 10_000),
    heartbeatTimeoutMs: readInt(env.MIRA_GATEWAY_HEARTBEAT_TIMEOUT_MS, 90_000),
    maxMessageBytes: readInt(env.MIRA_GATEWAY_MAX_MESSAGE_BYTES, 768 * 1024),
    screenMaxFramesPerSecond: readInt(env.MIRA_GATEWAY_SCREEN_MAX_FPS, 10),
    actionTimeoutMs: readInt(env.MIRA_GATEWAY_ACTION_TIMEOUT_MS, 15_000),
    actionLogMaxEntries: readInt(env.MIRA_GATEWAY_ACTION_LOG_MAX, 1000),
  };
}

export function isLocalAddress(address: string | undefined): boolean {
  if (!address) return false;
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1' ||
    address.endsWith('127.0.0.1')
  );
}

/**
 * Sicherheitsentscheidung: Darf diese Anfrage (Kopplung/Steuerung) über
 * unverschlüsseltes HTTP kommen? Standard: nur localhost. Hinter einem
 * TLS-Reverse-Proxy entscheidet X-Forwarded-Proto, wenn TRUST_PROXY gesetzt ist.
 */
export function isSecureRequest(
  remoteAddress: string | undefined,
  forwardedProto: string | undefined,
  config: GatewayConfig,
): boolean {
  if (config.allowPlainHttp) return true;
  if (isLocalAddress(remoteAddress)) return true;
  if (config.trustProxy) {
    return forwardedProto === 'https' || forwardedProto === 'wss';
  }
  return false;
}
