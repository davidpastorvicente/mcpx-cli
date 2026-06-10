import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import { GLOBAL_CONFIG_DISPLAY_PATH, ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders } from '../core/merger.js';

export async function toggleServerCommand(
  ctx: CommandContext,
  serverName: string | undefined,
  enabled: boolean,
): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn(`No ${GLOBAL_CONFIG_DISPLAY_PATH} found in this directory.`);
    p.log.info('Run "mcpx init" to create a configuration.');
    return;
  }

  const config = store.load();
  const targetName = serverName?.trim();

  if (!targetName) {
    p.log.error(`Please provide a server name to ${enabled ? 'enable' : 'disable'}.`);
    return;
  }

  const server = config.servers[targetName];
  if (!server) {
    p.log.error(`Server "${targetName}" not found.`);
    return;
  }

  if (enabled) {
    delete server.enabled;
  } else {
    server.enabled = false;
  }

  store.save(config);
  p.log.success(`Server "${targetName}" ${enabled ? 'enabled' : 'disabled'} in ${GLOBAL_CONFIG_DISPLAY_PATH}`);

  const registry = createRegistry();
  const providers = registry.getByNames(config.providers);
  const results = syncAllProviders(providers, ctx.projectRoot, config.servers);

  for (const result of results) {
    if (result.status === 'error') {
      p.log.error(`${result.filePath}: ${result.error}`);
    } else if (result.status !== 'unchanged') {
      p.log.success(`Updated: ${result.filePath}`);
    }
  }
}
