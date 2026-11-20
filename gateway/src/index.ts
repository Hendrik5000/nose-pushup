import path from 'node:path';
import { loadConfig } from './config.js';
import { GatewayStore } from './store.js';
import { Gateway } from './server.js';

/** Startpunkt des Device Control Gateways (Phase 4), siehe gateway/README.md. */
async function run(): Promise<void> {
  const config = loadConfig(process.env);
  const store = new GatewayStore(path.join(config.dataDir, 'gateway-state.json'), {
    actionLogMax: config.actionLogMaxEntries,
  });
  const gateway = new Gateway(config, store);
  await gateway.start();
  process.stderr.write('Mira Device Control Gateway luft (Phase 4) auf ' + config.host + ':' + gateway.getPort() + '\n');
  if (config.adminTokenGenerated) {
    process.stderr.write(
      'HINWEIS: kein MIRA_GATEWAY_ADMIN_TOKEN gesetzt. Automatisch erzeugter Admin-Token (jetzt sicher notieren): ' +
        config.adminToken +
        '\n',
    );
  }
  const shutdown = (): void => {
    void gateway
      .stop()
      .catch(() => undefined)
      .then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void run();
