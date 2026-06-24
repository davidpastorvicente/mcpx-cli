import os from 'node:os';
import path from 'node:path';
import * as p from '@clack/prompts';
import type { CommandContext, ConfigScope } from '../types/common.js';
import { runMainWizard } from '../wizard/main-wizard.js';
import { handleCancel, BACK } from '../wizard/step-runner.js';

export async function initCommand(ctx: CommandContext): Promise<void> {
  await runMainWizard(ctx.projectRoot, await selectScope(ctx.projectRoot));
}

async function selectScope(projectRoot: string): Promise<ConfigScope> {
  if (path.resolve(projectRoot) === path.resolve(os.homedir())) {
    return 'global';
  }

  const result = handleCancel(
    await p.select({
      message: 'Where should mcpx store this configuration?',
      options: [
        { value: 'project', label: 'Project', hint: '.agents/mcp.json in this folder' },
        { value: 'global', label: 'Global', hint: '~/.agents/mcp.json for your user' },
      ],
    }),
  );

  return result === BACK ? 'project' : result as ConfigScope;
}
