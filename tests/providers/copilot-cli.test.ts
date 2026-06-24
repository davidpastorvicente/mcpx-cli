import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { CopilotCliProvider } from '../../src/providers/copilot-cli.js';
import type { McpServerConfig } from '../../src/types/canonical.js';

describe('CopilotCliProvider', () => {
  const provider = new CopilotCliProvider();

  it('should generate JSON with mcpServers, type, and tools', () => {
    const servers: Record<string, McpServerConfig> = {
      github: {
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@anthropic-ai/mcp-github-server'],
        env: { GITHUB_TOKEN: 'ghp_xxx' },
      },
    };

    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers.github).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-github-server'],
      env: { GITHUB_TOKEN: 'ghp_xxx' },
      tools: ['*'],
    });
  });

  it('should parse Copilot CLI JSON', () => {
    const input = JSON.stringify({
      mcpServers: {
        test: {
          command: 'docker',
          args: ['run', '-i', '--rm', 'ghcr.io/github/github-mcp-server'],
          env: { GITHUB_TOKEN: 'token' },
        },
      },
    });

    const result = provider.parse(input);

    expect(result['test']?.transport).toBe('stdio');
    expect(result['test']?.enabled).toBe(true);
    expect(result['test']?.command).toBe('docker');
    expect(result['test']?.args).toContain('--rm');
  });

  it('should resolve project and global Copilot MCP config paths', () => {
    const projectFilePath = provider.getConfigFilePath('/tmp/project', 'project');
    const globalFilePath = provider.getConfigFilePath('/tmp/project', 'global');

    expect(projectFilePath).toBe(path.join('/tmp/project', '.copilot', 'mcp-config.json'));
    expect(globalFilePath).toBe(path.join(os.homedir(), '.copilot', 'mcp-config.json'));
    expect(provider.config.supportsProjectConfig).toBe(true);
    expect(provider.config.supportsGlobalConfig).toBe(true);
    expect(provider.config.configPath).toBe('.copilot/mcp-config.json');
  });

  it('should preserve unrelated top-level settings during merge', () => {
    const existing = `{
  "telemetry": true,
  "mcpServers": {
    "old": {
      "command": "old",
      "tools": ["*"]
    }
  }
}`;

    const output = provider.generate(
      {
        github: {
          enabled: true,
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@anthropic-ai/mcp-github-server'],
        },
      },
      existing,
    );
    const parsed = JSON.parse(output);

    expect(parsed.telemetry).toBe(true);
    expect(parsed.mcpServers.github).toBeDefined();
    expect(parsed.mcpServers.old).toBeUndefined();
  });
});
