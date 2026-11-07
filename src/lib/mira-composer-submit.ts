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
  currentRevision?: number;
  submittedRevision?: number;
}): string | null {
  const {
    activeSessionId,
    submittedSessionId,
    currentText,
    submittedText,
    currentRevision,
    submittedRevision,
  } = options;
  if (
    submittedText === null ||
    submittedText === "" ||
    activeSessionId !== submittedSessionId ||
    currentText !== "" ||
    (submittedRevision !== undefined && currentRevision !== submittedRevision)
  )
    return null;
  return submittedText;
}
