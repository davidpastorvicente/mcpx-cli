import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders } from '../core/merger.js';
import { handleCancel, BACK } from '../wizard/step-runner.js';

export async function removeCommand(ctx: CommandContext, serverName?: string): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn('No .mcpx.json found in this directory.');
    p.log.info('Run "mcpx init" to create a configuration.');
    return;
  }

  const config = store.load();
  const serverNames = Object.keys(config.servers);

  if (serverNames.length === 0) {
    p.log.info('No MCP servers configured.');
    return;
  }

  let name: string;

  if (serverName && config.servers[serverName]) {
    name = serverName;
  } else {
    const selected = handleCancel(
      await p.select({
        message: 'Which server do you want to remove?',
        options: serverNames.map((n) => ({ value: n, label: n })),
      }),
    );
    if (selected === BACK) return;
    name = selected;
  }

  const confirmed = handleCancel(
    await p.confirm({ message: `Confirm removal of server "${name}"?`, initialValue: false }),
  );
  if (confirmed === BACK || !confirmed) {
    p.cancel('Operation canceled.');
    return;
  }

  const updatedConfig = store.removeServer(name);
  p.log.success(`Server "${name}" removed.`);

  const registry = createRegistry();
  const providers = registry.getByNames(updatedConfig.providers);
  const results = syncAllProviders(providers, ctx.projectRoot, updatedConfig.servers);

  for (const r of results) {
    if (r.status === 'error') {
      p.log.error(`${r.filePath}: ${r.error}`);
    } else if (r.status !== 'unchanged') {
      p.log.success(`Updated: ${r.filePath}`);
    }
  }
}
