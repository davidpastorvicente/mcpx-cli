import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { handleCancel, BACK } from '../wizard/step-runner.js';
import { syncConfigProviders } from './sync-config-providers.js';

export async function removeCommand(ctx: CommandContext, serverName?: string): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn(`No ${store.getDisplayPath()} found.`);
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

  syncConfigProviders(ctx, store, updatedConfig);
}
