export async function loadBrowserPageInParallel(
  fetchHtml: () => Promise<string>,
  fetchReader: () => Promise<string>,
  onHtml?: (html: string) => void,
  onReader?: (reader: string) => void,
): Promise<{ html: string; reader: string }> {
  const htmlPromise = fetchHtml().then((html) => {
    if (html) onHtml?.(html);
    return html;
  });
  const readerPromise = fetchReader().then((reader) => {
    if (reader) onReader?.(reader);
    return reader;
  });

  const [html, reader] = await Promise.all([htmlPromise, readerPromise]);
  return { html, reader };
}
