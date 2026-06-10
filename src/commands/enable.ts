import type { CommandContext } from '../types/common.js';
import { toggleServerCommand } from './toggle.js';

export async function enableCommand(ctx: CommandContext, serverName?: string): Promise<void> {
  await toggleServerCommand(ctx, serverName, true);
}
