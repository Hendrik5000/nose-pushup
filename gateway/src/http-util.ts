import http from 'node:http';

export function json(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

/** JSON-Body unter Groessenlimit lesen; null bei Ungueltigkeit/Zu-Gross. */
export function readJsonBody(req: http.IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (value: unknown) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        finish(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > maxBytes) return;
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        finish(text === '' ? {} : JSON.parse(text));
      } catch {
        finish(null);
      }
    });
    req.on('error', () => finish(null));
  });
}

export function bearerToken(headerValue: string | undefined): string {
  if (!headerValue) return '';
  if (!headerValue.startsWith('Bearer ')) return '';
  return headerValue.slice('Bearer '.length).trim();
}

export function headerValue(req: http.IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}
