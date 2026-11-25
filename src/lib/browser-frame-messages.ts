export function isCurrentBrowserFrameMessage(
  eventSource: unknown,
  eventOrigin: string,
  receivedToken: unknown,
  expectedSource: unknown,
  expectedToken: string,
): boolean {
  return Boolean(
    expectedSource &&
    expectedToken &&
    eventSource === expectedSource &&
    eventOrigin === "null" &&
    receivedToken === expectedToken,
  );
}
