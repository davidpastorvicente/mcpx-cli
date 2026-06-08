import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { CommandContext } from '../types/common.js';
import { ConfigStore } from '../core/config-store.js';
import { createRegistry } from '../providers/registry.js';

export async function listCommand(ctx: CommandContext): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);

  if (!store.exists()) {
    p.log.warn('No .mcpx.json found in this directory.');
    p.log.info('Run "mcpx init" to create a configuration.');
    return;
  }

  const config = store.load();
  const registry = createRegistry();
  const servers = Object.entries(config.servers);

  if (servers.length === 0) {
    p.log.info('No MCP servers configured.');
    return;
  }

  const lines = servers.map(([name, server]) => {
    const status = server.enabled === false ? pc.dim(' [disabled]') : '';
    const cmd =
      server.transport === 'stdio'
        ? `${server.command} ${(server.args ?? []).join(' ')}`
        : server.url ?? '';
    const desc = server.description ? pc.dim(` - ${server.description}`) : '';
    return `${pc.bold(name)} ${pc.dim(`(${server.transport})`)}${status}\n  ${pc.cyan(cmd)}${desc}`;
  });

  p.note(lines.join('\n\n'), 'MCP Servers');

  const providerNames = config.providers
    .map((pn) => registry.get(pn)?.config.displayName ?? pn)
    .join(', ');

  p.log.info(`Enabled providers: ${providerNames || 'none'}`);
}
