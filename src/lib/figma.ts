type FigmaFileResponse = {
  name?: string;
  thumbnail_url?: string;
  last_modified?: string;
  document?: {
    children?: Array<{
      id?: string;
      name?: string;
      children?: unknown[];
    }>;
  };
};

type FigmaFileMeta = {
  name: string;
  lastModified: string | null;
  thumbnailUrl: string | null;
  nodeCount: number;
  fileUrl: string;
};

function readEnv(key: string) {
  const viteEnv = typeof import.meta !== "undefined" ? (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env : undefined;
  const viteValue = viteEnv?.[key];
  const processValue = typeof process !== "undefined" ? process.env?.[key] : undefined;
  return (viteValue ?? processValue ?? "").toString();
}

export function getFigmaAccessToken() {
  return readEnv("VITE_FIGMA_ACCESS_TOKEN") || readEnv("FIGMA_ACCESS_TOKEN");
}

export function getFigmaFileKey() {
  return readEnv("VITE_FIGMA_FILE_KEY") || readEnv("FIGMA_FILE_KEY");
}

export function isFigmaConfigured() {
  return Boolean(getFigmaAccessToken() && getFigmaFileKey());
}

export function getFigmaFileUrl(fileKey: string, nodeId?: string) {
  const base = `https://www.figma.com/file/${fileKey}`;
  return nodeId ? `${base}?node-id=${nodeId}` : base;
}

export async function fetchFigmaFileMeta(): Promise<FigmaFileMeta> {
  const token = getFigmaAccessToken();
  const fileKey = getFigmaFileKey();

  if (!token || !fileKey) {
    throw new Error("Figma ist noch nicht konfiguriert. Bitte Token und File-Key ergänzen.");
  }

  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Figma-API Fehler (${response.status}): ${detail || "Unbekannter Fehler"}`);
  }

  const data = (await response.json()) as FigmaFileResponse;
  const rootChildren = data.document?.children ?? [];
  const nodeCount = rootChildren.length;

  return {
    name: data.name ?? "Unbenannter Figma-File",
    lastModified: data.last_modified ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    nodeCount,
    fileUrl: getFigmaFileUrl(fileKey),
  };
}
