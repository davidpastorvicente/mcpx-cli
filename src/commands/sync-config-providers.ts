import * as p from '@clack/prompts';
import type { McpConfigFile } from '../types/canonical.js';
import type { CommandContext } from '../types/common.js';
import { syncAllProviders } from '../core/merger.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';

export function syncConfigProviders(ctx: CommandContext, store: ConfigStore, config: McpConfigFile): void {
  const providers = createRegistry()
    .getByNames(config.providers)
    .filter((provider) => store.scope === 'project' ? provider.config.supportsProjectConfig : provider.config.supportsGlobalConfig);

  for (const result of syncAllProviders(providers, ctx.projectRoot, config.servers, store.scope)) {
    if (result.status === 'error') {
      p.log.error(`${result.filePath}: ${result.error}`);
    } else if (result.status !== 'unchanged') {
      p.log.success(`Updated: ${result.filePath}`);
    }
  }
}
