import { Command } from 'commander';
import type { CommandContext } from './types/common.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { listCommand } from './commands/list.js';
import { syncCommand } from './commands/sync.js';
import { importCommand } from './commands/import.js';
import { statusCommand } from './commands/status.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('mcpx')
    .description('CLI for configuring MCP servers across multiple AI providers')
    .version('0.1.0')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .option('--verbose', 'Show detailed logs', false);

  function getContext(): CommandContext {
    const opts = program.opts();
    return {
      projectRoot: opts['dir'] as string,
      verbose: opts['verbose'] as boolean,
    };
  }

  program
    .command('init')
    .description('Interactive setup wizard')
    .action(() => initCommand(getContext()));

  program
    .command('add')
    .description('Add an MCP server')
    .argument('[name]', 'Server name')
    .action((name?: string) => addCommand(getContext(), name));

  program
    .command('remove')
    .description('Remove an MCP server')
    .argument('[name]', 'Server name')
    .action((name?: string) => removeCommand(getContext(), name));

  program
    .command('list')
    .description('List configured MCP servers')
    .action(() => listCommand(getContext()));

  program
    .command('sync')
    .description('Regenerate provider configuration files')
    .action(() => syncCommand(getContext()));

  program
    .command('import')
    .description('Import configuration from an existing provider')
    .argument('[provider]', 'Provider name')
    .action((provider?: string) => importCommand(getContext(), provider));

  program
    .command('status')
    .description('Show provider sync status')
    .action(() => statusCommand(getContext()));

  // Default command: init
  program.action(() => initCommand(getContext()));

  return program;
}
