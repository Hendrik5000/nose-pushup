export function captureMiraComposerTextForSubmission(
  composerText: string,
  textOverride: string | undefined,
  preserveComposer: boolean,
): string | null {
  return textOverride === undefined && !preserveComposer ? composerText : null;
}

export function restoreMiraComposerTextAfterFailure(options: {
  activeSessionId: string;
  submittedSessionId: string;
  currentText: string;
  submittedText: string | null;
}): string | null {
  const { activeSessionId, submittedSessionId, currentText, submittedText } = options;
  if (
    submittedText === null ||
    submittedText === "" ||
    activeSessionId !== submittedSessionId ||
    currentText !== ""
  )
    return null;
  return submittedText;
}
