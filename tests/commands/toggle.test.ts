import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore, GLOBAL_CONFIG_PATH } from '../../src/core/config-store.js';
import { disableCommand } from '../../src/commands/disable.js';
import { enableCommand } from '../../src/commands/enable.js';

describe('toggle commands', () => {
  let tmpDir: string;
  const homedirSpy = vi.spyOn(os, 'homedir');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpx-toggle-test-'));
    homedirSpy.mockReturnValue(tmpDir);
  });

  afterEach(() => {
    homedirSpy.mockReset();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should disable a server by setting enabled to false', async () => {
    const store = new ConfigStore(tmpDir);
    store.save({
      version: 1,
      providers: [],
      servers: {
        alpha: { transport: 'stdio', command: 'npx' },
      },
    });

    await disableCommand({ projectRoot: '/unused', verbose: false }, 'alpha');

    const config = store.load();
    expect(config.servers.alpha?.enabled).toBe(false);
  });

  it('should enable a server by removing enabled false', async () => {
    const store = new ConfigStore(tmpDir);
    store.save({
      version: 1,
      providers: [],
      servers: {
        alpha: { transport: 'stdio', command: 'npx', enabled: false },
      },
    });

    await enableCommand({ projectRoot: '/unused', verbose: false }, 'alpha');

    const config = store.load();
    expect(config.servers.alpha?.enabled).toBeUndefined();
  });

  it('should keep using the global MCPX config file', () => {
    const store = new ConfigStore(tmpDir);
    expect(store.getPath()).toBe(GLOBAL_CONFIG_PATH);
  });
});
