import { describe, it, expect } from 'vitest';
import { CopilotCliProvider } from '../../src/providers/copilot-cli.js';
import type { McpServerConfig } from '../../src/types/canonical.js';

describe('CopilotCliProvider', () => {
  const provider = new CopilotCliProvider();

  it('should generate JSON with mcpServers and no type field', () => {
    const servers: Record<string, McpServerConfig> = {
      github: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@anthropic-ai/mcp-github-server'],
        env: { GITHUB_TOKEN: 'ghp_xxx' },
      },
    };

    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers.github).toEqual({
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
    expect(result['test']?.command).toBe('docker');
    expect(result['test']?.args).toContain('--rm');
  });

  it('should include cwd when defined', () => {
    const servers: Record<string, McpServerConfig> = {
      test: {
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        cwd: '/path/to/project',
      },
    };

    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers.test.cwd).toBe('/path/to/project');
    expect(parsed.mcpServers.test.tools).toEqual(['*']);
  });

  it('should be a project-scoped provider', () => {
    expect(provider.config.supportsProjectConfig).toBe(true);
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
