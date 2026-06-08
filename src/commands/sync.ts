import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders } from '../core/merger.js';
import { ensureShellAlias } from '../utils/fs.js';

export async function syncCommand(ctx: CommandContext): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn('No .mcpx.json found in this directory.');
    p.log.info('Run "mcpx init" to create a configuration.');
    return;
  }

  const config = store.load();
  const registry = createRegistry();
  const providers = registry.getByNames(config.providers);

  if (providers.length === 0) {
    p.log.warn('No providers configured.');
    return;
  }

  const sp = p.spinner();
  sp.start('Syncing configurations...');

  const results = syncAllProviders(providers, ctx.projectRoot, config.servers);

  sp.stop('Sync complete.');

  let updated = 0;
  let created = 0;
  let unchanged = 0;
  let deleted = 0;
  let errors = 0;

  for (const result of results) {
    switch (result.status) {
      case 'created':
        p.log.success(`${result.filePath} (created)`);
        created++;
        break;
      case 'updated':
        p.log.success(`${result.filePath} (updated)`);
        updated++;
        break;
      case 'unchanged':
        p.log.step(`${result.filePath} (unchanged)`);
        unchanged++;
        break;
      case 'deleted':
        p.log.warn(`${result.filePath} (removed)`);
        deleted++;
        break;
      case 'error':
        p.log.error(`${result.filePath}: ${result.error}`);
        errors++;
        break;
    }
  }

  const parts: string[] = [];
  if (created > 0) parts.push(`${created} created`);
  if (updated > 0) parts.push(`${updated} updated`);
  if (deleted > 0) parts.push(`${deleted} removed`);
  if (unchanged > 0) parts.push(`${unchanged} unchanged`);
  if (errors > 0) parts.push(`${errors} errors`);

  p.log.info(`${results.length} providers processed (${parts.join(', ')})`);

  if (config.providers.includes('copilot-cli')) {
    if (ensureShellAlias('copilot', 'copilot --additional-mcp-config @.copilot/mcp-config.json')) {
      p.log.success('Configured the "copilot" shell alias (run "source ~/.zshrc" or restart the terminal).');
    }
  }
}
