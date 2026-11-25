// Each navigation gets a unique identity, including after a tab is closed or reset.
// Requests may finish in the background, but their obsolete results cannot update the tab.
export function createBrowserNavigationGuard() {
  const current = new Map<string, object>();

  return {
    begin(tabId: string): () => boolean {
      const token = {};
      current.set(tabId, token);
      return () => current.get(tabId) === token;
    },
    invalidate(tabId: string): void {
      current.delete(tabId);
    },
  };
}

export type BrowserHistoryEntry = { kind: "url"; value: string } | {
  kind: "search";
  value: string;
};

export function nextBrowserHistory(
  history: BrowserHistoryEntry[],
  currentIndex: number,
  target: BrowserHistoryEntry,
  push: boolean,
  targetIndex?: number,
): { history: BrowserHistoryEntry[]; historyIndex: number } {
  if (!push) return { history, historyIndex: targetIndex ?? currentIndex };
  const next = [...history.slice(0, currentIndex + 1), target];
  return { history: next, historyIndex: next.length - 1 };
}
