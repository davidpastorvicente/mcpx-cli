import type { CommandContext } from '../types/common.js';
import { toggleServerCommand } from './toggle.js';

export async function disableCommand(ctx: CommandContext, serverName?: string): Promise<void> {
  await toggleServerCommand(ctx, serverName, false);
}
