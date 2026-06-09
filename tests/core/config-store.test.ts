import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore } from '../../src/core/config-store.js';

describe('ConfigStore', () => {
  let tmpDir: string;
  let store: ConfigStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpx-test-'));
    store = new ConfigStore(tmpDir);
  });

  afterEach(() => {
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

  it('should add and remove a server', () => {
    store.createEmpty([]);

    store.addServer('test', {
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
      transport: 'stdio',
      command: 'npx',
    });
    store.addServer('alpha', {
      transport: 'stdio',
      command: 'uvx',
    });

    const config = store.load();
    expect(Object.keys(config.servers)).toEqual(['alpha', 'zeta']);
  });

  it('should throw for invalid config', () => {
    const configPath = path.join(tmpDir, '.mcpx.json');
    fs.writeFileSync(configPath, JSON.stringify({ invalid: true }));

    expect(() => store.load()).toThrow();
  });
});
