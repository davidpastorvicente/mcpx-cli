import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';
import { readTextFile, fileExists } from '../utils/fs.js';

export async function statusCommand(ctx: CommandContext): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn(`No ${store.getDisplayPath()} found.`);
    p.log.info('Run "mcpx init" to create a configuration.');
    return;
  }

  const config = store.load();
  const registry = createRegistry();
  const serverCount = Object.keys(config.servers).length;

  let hasDesync = false;
  const lines: string[] = [];

  for (const providerName of config.providers) {
    const provider = registry.get(providerName);
    if (!provider) continue;
    if (store.scope === 'project' && !provider.config.supportsProjectConfig) continue;
    if (store.scope === 'global' && !provider.config.supportsGlobalConfig) continue;

    const filePath = provider.getConfigFilePath(ctx.projectRoot, store.scope);
    const expectedContent = provider.generate(config.servers, undefined, store.scope, ctx.projectRoot);

    const displayPath = store.scope === 'project'
      ? provider.config.configPath
      : provider.config.globalConfigPath ?? provider.config.configPath;

    let status: string;
    if (!fileExists(filePath)) {
      status = pc.red('missing');
      hasDesync = true;
    } else {
      const currentContent = readTextFile(filePath);
      if (currentContent === expectedContent) {
        status = pc.green('sync');
      } else {
        status = pc.yellow('desync');
        hasDesync = true;
      }
    }

    lines.push(`${pc.bold(provider.config.displayName.padEnd(16))} ${displayPath.padEnd(30)} ${status}`);
  }

  p.note(
    lines.join('\n'),
    `${serverCount} server(s), ${config.providers.length} provider(s)`,
  );

  if (hasDesync) {
    p.log.warn('Some providers are out of date. Run "mcpx sync" to update them.');
  } else {
    p.log.success('All providers are synchronized.');
  }
}
