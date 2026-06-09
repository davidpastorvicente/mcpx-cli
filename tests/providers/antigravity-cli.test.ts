import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { AntigravityCliProvider } from '../../src/providers/antigravity-cli.js';
import type { McpServerConfig } from '../../src/types/canonical.js';

describe('AntigravityCliProvider', () => {
  const provider = new AntigravityCliProvider();

  it('should resolve to the shared Antigravity MCP config path', () => {
    const filePath = provider.getConfigFilePath('/tmp/project');

    expect(filePath).toBe(path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'));
    expect(provider.config.displayName).toBe('Antigravity CLI');
    expect(provider.config.supportsProjectConfig).toBe(false);
  });

  it('should generate stdio MCP servers under mcpServers', () => {
    const servers: Record<string, McpServerConfig> = {
      test: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'test-server'],
        env: { KEY: 'value' },
      },
    };

    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers.test).toEqual({
      command: 'npx',
      args: ['-y', 'test-server'],
      env: { KEY: 'value' },
    });
  });

  it('should map canonical http transport to serverUrl', () => {
    const servers: Record<string, McpServerConfig> = {
      remote: {
        transport: 'http',
        url: 'https://mcp.example.com',
        headers: { Authorization: 'Bearer token' },
      },
    };

    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers.remote).toEqual({
      serverUrl: 'https://mcp.example.com',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('should parse serverUrl as canonical http transport', () => {
    const input = JSON.stringify({
      mcpServers: {
        remote: {
          serverUrl: 'https://mcp.example.com',
          headers: { Authorization: 'Bearer token' },
        },
      },
    });

    const result = provider.parse(input);

    expect(result.remote).toEqual({
      transport: 'http',
      url: 'https://mcp.example.com',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('should preserve unrelated top-level settings during merge', () => {
    const existing = `{
  "plugins": {
    "example": true
  },
  "mcpServers": {
    "old": {
      "command": "old"
    }
  }
}`;

    const output = provider.generate(
      {
        test: {
          transport: 'stdio',
          command: 'npx',
          args: ['-y', 'test-server'],
        },
      },
      existing,
    );
    const parsed = JSON.parse(output);

    expect(parsed.plugins).toEqual({ example: true });
    expect(parsed.mcpServers.test).toBeDefined();
    expect(parsed.mcpServers.old).toBeUndefined();
  });

  it('should keep disabled servers and emit disabled true', () => {
    const servers: Record<string, McpServerConfig> = {
      disabled: {
        transport: 'http',
        url: 'https://mcp.example.com',
        enabled: false,
      },
    };

    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers.disabled).toEqual({
      serverUrl: 'https://mcp.example.com',
      disabled: true,
    });
  });
});
