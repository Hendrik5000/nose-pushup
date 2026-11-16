export interface GameFullscreenTarget {
  requestFullscreen?: () => Promise<void>;
}

export interface GameFullscreenDocument {
  fullscreenElement: GameFullscreenTarget | null;
  exitFullscreen: () => Promise<void>;
}

export async function toggleGameFullscreen(
  element: GameFullscreenTarget | null,
  fullscreenDocument: GameFullscreenDocument,
): Promise<boolean> {
  if (!element) return false;

  try {
    if (fullscreenDocument.fullscreenElement === element) {
      await fullscreenDocument.exitFullscreen();
    } else if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
