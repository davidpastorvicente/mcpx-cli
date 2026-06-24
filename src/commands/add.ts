import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders } from '../core/merger.js';
import { runServerWizard } from '../wizard/server-wizard.js';

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

  const registry = createRegistry();
  const providers = registry
    .getByNames(updatedConfig.providers)
    .filter((provider) => store.scope === 'project' ? provider.config.supportsProjectConfig : provider.config.supportsGlobalConfig);
  const results = syncAllProviders(providers, ctx.projectRoot, updatedConfig.servers, store.scope);

  for (const r of results) {
    if (r.status === 'error') {
      p.log.error(`${r.filePath}: ${r.error}`);
    } else if (r.status !== 'unchanged') {
      p.log.success(`Updated: ${r.filePath}`);
    }
  }
}
