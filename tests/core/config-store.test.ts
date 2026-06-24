import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore, getGlobalConfigPath, getProjectConfigPath } from '../../src/core/config-store.js';

describe('ConfigStore', () => {
  let tmpDir: string;
  let store: ConfigStore;
  const homedirSpy = vi.spyOn(os, 'homedir');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpx-test-'));
    homedirSpy.mockReturnValue(tmpDir);
    store = new ConfigStore(tmpDir, 'global');
  });

  afterEach(() => {
    homedirSpy.mockReset();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return false when config does not exist', () => {
    expect(store.exists()).toBe(false);
  });

  it('should create an empty config', () => {
    const config = store.createEmpty(['claude-code']);
    expect(config.version).toBe(1);
    expect(config.providers).toEqual(['claude-code']);
    expect(config.servers).toEqual({});
    expect(store.exists()).toBe(true);
  });

  it('should use a project config when requested', () => {
    const projectStore = new ConfigStore(tmpDir, 'project');
    projectStore.createEmpty(['claude-code']);

    expect(projectStore.getPath()).toBe(getProjectConfigPath(tmpDir));
    expect(projectStore.getDisplayPath()).toBe('.agents/mcp.json');
  });

  it('should auto-detect an existing project config before global config', () => {
    const projectStore = new ConfigStore(tmpDir, 'project');
    projectStore.createEmpty(['claude-code']);

    const detected = new ConfigStore(tmpDir);

    expect(detected.scope).toBe('project');
    expect(detected.getPath()).toBe(getProjectConfigPath(tmpDir));
  });

  it('should add and remove a server', () => {
    store.createEmpty([]);

    store.addServer('test', {
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'test-server'],
    });

    let config = store.load();
    expect(config.servers['test']?.command).toBe('npx');

    store.removeServer('test');
    config = store.load();
    expect(config.servers['test']).toBeUndefined();
  });

  it('should update providers', () => {
    store.createEmpty([]);
    store.setProviders(['claude-code', 'antigravity-cli']);

    const config = store.load();
    expect(config.providers).toEqual(['antigravity-cli', 'claude-code']);
  });

  it('should save providers in alphabetical order', () => {
    store.createEmpty([]);
    store.setProviders(['vscode', 'antigravity-cli', 'claude-code']);

    const config = store.load();
    expect(config.providers).toEqual(['antigravity-cli', 'claude-code', 'vscode']);
  });

  it('should save servers in alphabetical order by key', () => {
    store.createEmpty([]);

    store.addServer('zeta', {
      enabled: true,
      transport: 'stdio',
      command: 'npx',
    });
    store.addServer('alpha', {
      enabled: true,
      transport: 'stdio',
      command: 'uvx',
    });

    const config = store.load();
    expect(Object.keys(config.servers)).toEqual(['alpha', 'zeta']);
  });

  it('should save server properties in canonical order', () => {
    store.createEmpty([]);

    store.addServer('ordered', {
      env: { TOKEN: 'abc' },
      command: 'npx',
      headers: { Authorization: 'Bearer test' },
      enabled: true,
      transport: 'http',
      args: ['-y', 'server'],
      url: 'https://mcp.example.com',
    });

    const config = store.load();
    expect(Object.keys(config.servers.ordered ?? {})).toEqual([
      'enabled',
      'transport',
      'url',
      'headers',
      'command',
      'args',
      'env',
    ]);
  });

  it('should throw for invalid config', () => {
    const configPath = getGlobalConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ invalid: true }));

    expect(() => store.load()).toThrow();
  });
});
