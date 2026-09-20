import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { runServerWizard } from '../wizard/server-wizard.js';
import { syncConfigProviders } from './sync-config-providers.js';

export async function addCommand(ctx: CommandContext, serverName?: string): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn(`No ${store.getDisplayPath()} found.`);
    p.log.info('Run "mcpx init" to create a configuration.');
    return;
  }

  const config = store.load();
  const existingNames = Object.keys(config.servers);

  if (serverName && config.servers[serverName]) {
    p.log.warn(`Server "${serverName}" already exists. Use another name.`);
    return;
  }

  const result = await runServerWizard(existingNames);
  if (!result) {
    p.cancel('Operation canceled.');
    return;
  }

  const updatedConfig = store.addServer(result.name, result.config);
  p.log.success(`Server "${result.name}" added to ${store.getDisplayPath()}`);

  syncConfigProviders(ctx, store, updatedConfig);
}
