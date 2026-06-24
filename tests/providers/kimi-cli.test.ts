import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { KimiCliProvider } from '../../src/providers/kimi-cli.js';

describe('KimiCliProvider', () => {
  const provider = new KimiCliProvider();

  it('should resolve project and global Kimi Code MCP config paths', () => {
    expect(provider.getConfigFilePath('/tmp/project', 'project')).toBe(path.join('/tmp/project', '.kimi-code', 'mcp.json'));
    expect(provider.getConfigFilePath('/tmp/project', 'global')).toBe(path.join(os.homedir(), '.kimi-code', 'mcp.json'));
    expect(provider.config.supportsProjectConfig).toBe(true);
    expect(provider.config.supportsGlobalConfig).toBe(true);
  });
});
