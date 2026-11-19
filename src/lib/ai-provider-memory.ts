const providerMemory = new Map<string, unknown>();

function providerMemoryKey(userId?: string | null): string {
  return userId ? `user:${userId}` : "anonymous";
}

/** Return a defensive copy so UI edits cannot mutate the shared in-tab value. */
export function getProviderMemory<T>(userId?: string | null): T | null {
  const value = providerMemory.get(providerMemoryKey(userId));
  return value === undefined ? null : structuredClone(value as T);
}

export function setProviderMemory<T>(userId: string | null | undefined, value: T): void {
  providerMemory.set(providerMemoryKey(userId), structuredClone(value));
}

/** Clear all API-key state on logout/account switch, or one explicitly named account. */
export function clearProviderMemory(userId?: string | null): void {
  if (userId === undefined) {
    providerMemory.clear();
    return;
  }
  providerMemory.delete(providerMemoryKey(userId));
}
