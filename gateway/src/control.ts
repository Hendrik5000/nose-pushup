

import { timingSafeEqual } from 'node:crypto';
import type http from 'node:http';
import type { Gateway } from './server.js';
import type { GatewayConfig } from './config.js';
import type { GatewayStore } from './store.js';
import { bearerToken, json, readJsonBody } from './http-util.js';
import { validatePermissionMap } from './policy.js';

export type ControlContext = {
  gateway: Gateway;
  config: GatewayConfig;
  store: GatewayStore;
  req: http.IncomingMessage;
  res: http.ServerResponse;
};

function validUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function ownsDevice(ctx: ControlContext, deviceId: string, userId: string): boolean {
  return ctx.store.getDevice(deviceId)?.ownerUserId === userId;
}

function tokenOk(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Kontroll-API für die Mira-App (Anbindung in Phase 5). Geschützt durch den
 * Admin-Token; bei Standard-Host 127.0.0.1 nur lokal erreichbar, im Betrieb
 * hinter dem TLS-Reverse-Proxy.
 */
export async function handleControlRequest(ctx: ControlContext): Promise<void> {
  const provided = bearerToken(ctx.req.headers.authorization);
  if (!tokenOk(provided, ctx.config.adminToken)) {
    json(ctx.res, 401, { error: 'unauthorisiert' });
    return;
  }
  const url = new URL(ctx.req.url ?? '/', 'http://localhost');
  const route = url.pathname.slice('/v1/control/'.length);
  const knownRoutes = new Set([
    'devices',
    'action-log',
    'not-aus',
    'pairing-code',
    'permissions',
    'action',
    'screen',
    'revoke',
  ]);
  if (!knownRoutes.has(route)) {
    json(ctx.res, 404, { error: 'nicht-gefunden' });
    return;
  }

  if (ctx.req.method === 'GET' && route === 'devices') {
    const userId = url.searchParams.get('userId');
    if (!validUserId(userId)) { json(ctx.res, 400, { error: 'ungueltige-anfrage' }); return; }
    json(ctx.res, 200, { devices: ctx.gateway.listDevicesOnline(userId) });
    return;
  }
  if (ctx.req.method === 'GET' && route === 'action-log') {
    const userId = url.searchParams.get('userId');
    if (!validUserId(userId)) { json(ctx.res, 400, { error: 'ungueltige-anfrage' }); return; }
    const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1), 1000);
    json(ctx.res, 200, { entries: ctx.store.getActionLogForOwner(userId, limit) });
    return;
  }
  if (ctx.req.method === 'GET' && route === 'not-aus') {
    const userId = url.searchParams.get('userId');
    if (!validUserId(userId)) { json(ctx.res, 400, { error: 'ungueltige-anfrage' }); return; }
    json(ctx.res, 200, { aktiv: ctx.gateway.isEmergencyStopActive(userId) });
    return;
  }

  if (ctx.req.method !== 'POST') {
    json(ctx.res, 405, { error: 'methode-nicht-erlaubt' });
    return;
  }

  const body = await readJsonBody(ctx.req, 64 * 1024);
  if (body === null || typeof body !== 'object') {
    json(ctx.res, 400, { error: 'ungueltige-anfrage' });
    return;
  }
  const b = body as Record<string, unknown>;
  const userId = b.userId;
  if (!validUserId(userId)) { json(ctx.res, 400, { error: 'ungueltige-anfrage' }); return; }

  if (route === 'pairing-code') {
    const record = ctx.store.createPairingCode(new Date(), ctx.config.pairingCodeTtlMs, userId);
    ctx.store.appendLog({ kind: 'kopplung', status: 'code-erzeugt' });
    json(ctx.res, 200, { code: record.code, expiresAt: record.expiresAt });
    return;
  }

  if (route === 'permissions') {
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';
    const permissions = validatePermissionMap(b.permissions);
    if (!deviceId || permissions === null) {
      json(ctx.res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    if (!ownsDevice(ctx, deviceId, userId)) { json(ctx.res, 404, { error: 'geraet-unbekannt' }); return; }
    const device = ctx.store.setPermissions(deviceId, permissions);
    if (!device) {
      json(ctx.res, 404, { error: 'geraet-unbekannt' });
      return;
    }
    ctx.store.appendLog({ kind: 'sitzung', deviceId, status: 'berechtigungen-aktualisiert' });
    ctx.gateway.refreshPolicy(deviceId);
    json(ctx.res, 200, { ok: true, fingerprint: device.fingerprint });
    return;
  }

  if (route === 'action') {
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';
    const toolId = typeof b.toolId === 'string' ? b.toolId : '';
    if (!deviceId || !toolId) {
      json(ctx.res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    if (!ownsDevice(ctx, deviceId, userId)) { json(ctx.res, 404, { error: 'geraet-unbekannt' }); return; }
    const outcome = await ctx.gateway.dispatchAction({
      deviceId,
      ownerUserId: userId,
      toolId,
      args: b.args,
      confirmationGranted: b.confirmation === true,
    });
    if (!outcome.dispatched) {
      json(ctx.res, 409, { dispatched: false, reason: outcome.reason });
      return;
    }
    json(ctx.res, 200, {
      dispatched: true,
      requestId: outcome.requestId,
      status: outcome.status,
      detail: outcome.detail,
    });
    return;
  }

  if (route === 'not-aus') {
    const aktiv = b.aktiv === true;
    const grund = typeof b.grund === 'string' ? b.grund.slice(0, 200) : '';
    ctx.gateway.setEmergencyStop(aktiv, grund, userId);
    json(ctx.res, 200, { ok: true, aktiv });
    return;
  }

  if (route === 'screen') {
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';
    if (!deviceId) {
      json(ctx.res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    const started = b.aktiv !== false;
    if (!ownsDevice(ctx, deviceId, userId)) { json(ctx.res, 404, { error: 'geraet-unbekannt' }); return; }
    const result = started
      ? ctx.gateway.startScreenSession(deviceId, userId)
      : ctx.gateway.stopScreenSession(deviceId, 'beendet-durch-nutzer', userId);
    if (result.ok) {
      json(ctx.res, 200, { ok: true, sessionId: result.sessionId });
    } else {
      json(ctx.res, 409, { ok: false, reason: result.reason });
    }
    return;
  }

  if (route === 'revoke') {
    const deviceId = typeof b.deviceId === 'string' ? b.deviceId : '';
    if (!deviceId) {
      json(ctx.res, 400, { error: 'ungueltige-anfrage' });
      return;
    }
    if (!ownsDevice(ctx, deviceId, userId)) { json(ctx.res, 404, { error: 'geraet-unbekannt' }); return; }
    const revoked = ctx.gateway.revokeDevice(deviceId, typeof b.grund === 'string' ? b.grund.slice(0, 200) : '');
    json(ctx.res, revoked ? 200 : 404, revoked ? { ok: true } : { error: 'geraet-unbekannt' });
    return;
  }

  json(ctx.res, 404, { error: 'nicht-gefunden' });
}
