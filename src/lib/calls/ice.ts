/**
 * ICE server configuration. STUN alone connects most home and Wi-Fi networks, but some mobile or
 * corporate networks need a TURN relay. Configure one with:
 *   VITE_TURN_URLS="turn:turn.example.com:3478,turns:turn.example.com:5349"
 *   VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL
 */
export const DEFAULT_STUN_URLS = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

export type IceEnv = {
  VITE_TURN_URLS?: string;
  VITE_TURN_USERNAME?: string;
  VITE_TURN_CREDENTIAL?: string;
  VITE_STUN_URLS?: string;
};

function splitUrls(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => /^(stun|stuns|turn|turns):/i.test(entry));
}

export function buildIceServers(
  env: IceEnv = {},
): { urls: string[]; username?: string; credential?: string }[] {
  const stun = splitUrls(env.VITE_STUN_URLS);
  const servers: { urls: string[]; username?: string; credential?: string }[] = [
    { urls: stun.length > 0 ? stun : DEFAULT_STUN_URLS },
  ];
  const turn = splitUrls(env.VITE_TURN_URLS);
  if (turn.length > 0 && env.VITE_TURN_USERNAME && env.VITE_TURN_CREDENTIAL) {
    servers.push({
      urls: turn,
      username: env.VITE_TURN_USERNAME,
      credential: env.VITE_TURN_CREDENTIAL,
    });
  }
  return servers;
}

export function hasTurn(env: IceEnv = {}): boolean {
  return buildIceServers(env).length > 1;
}
