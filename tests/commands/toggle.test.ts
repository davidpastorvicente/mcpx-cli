import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore, getGlobalConfigPath } from '../../src/core/config-store.js';
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
    const store = new ConfigStore(tmpDir, 'global');
    store.save({
      version: 1,
      providers: [],
      servers: {
        alpha: { enabled: true, transport: 'stdio', command: 'npx' },
      },
    });

    await disableCommand({ projectRoot: tmpDir, verbose: false }, 'alpha');

    const config = store.load();
    expect(config.servers.alpha?.enabled).toBe(false);
  });

  it('should enable a server by setting enabled to true', async () => {
    const store = new ConfigStore(tmpDir, 'global');
    store.save({
      version: 1,
      providers: [],
      servers: {
        alpha: { transport: 'stdio', command: 'npx', enabled: false },
      },
    });

    await enableCommand({ projectRoot: tmpDir, verbose: false }, 'alpha');

    const config = store.load();
    expect(config.servers.alpha?.enabled).toBe(true);
  });

  it('should keep using the global MCPX config file', () => {
    const store = new ConfigStore(tmpDir, 'global');
    expect(store.getPath()).toBe(getGlobalConfigPath());
  });
});
