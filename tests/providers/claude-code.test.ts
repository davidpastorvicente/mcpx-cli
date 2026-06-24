import { describe, it, expect } from 'vitest';
import { ClaudeCodeProvider } from '../../src/providers/claude-code.js';
import type { McpServerConfig } from '../../src/types/canonical.js';

describe('ClaudeCodeProvider', () => {
  const provider = new ClaudeCodeProvider();

  const servers: Record<string, McpServerConfig> = {
    'jira-tvx': {
      enabled: true,
      transport: 'stdio',
      command: 'uvx',
      args: ['mcp-atlassian'],
      env: { JIRA_URL: 'https://jira.example.com' },
    },
    'github-tvx': {
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-github-server'],
      env: { GITHUB_TOKEN: 'ghp_xxx' },
    },
  };

  it('should generate JSON with mcpServers and stdio type', () => {
    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers['jira-tvx']).toEqual({
      type: 'stdio',
      command: 'uvx',
      args: ['mcp-atlassian'],
      env: { JIRA_URL: 'https://jira.example.com' },
    });

    expect(parsed.mcpServers['github-tvx'].type).toBe('stdio');
  });

  it('should ignore disabled servers', () => {
    const output = provider.generate({
      disabled: { transport: 'stdio', command: 'test', enabled: false },
      enabled: { enabled: true, transport: 'stdio', command: 'test' },
    });
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers['disabled']).toBeUndefined();
    expect(parsed.mcpServers['enabled']).toBeDefined();
  });

  it('should parse Claude Code JSON', () => {
    const input = JSON.stringify({
      mcpServers: {
        test: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', 'test-server'],
          env: { KEY: 'value' },
        },
      },
    });

    const result = provider.parse(input);

    expect(result['test']).toEqual({
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'test-server'],
      env: { KEY: 'value' },
    });
  });

  it('should roundtrip generate -> parse with the same result', () => {
    const generated = provider.generate(servers);
    const parsed = provider.parse(generated);

    expect(parsed['jira-tvx']?.command).toBe('uvx');
    expect(parsed['jira-tvx']?.args).toEqual(['mcp-atlassian']);
    expect(parsed['jira-tvx']?.transport).toBe('stdio');
  });

  it('should support http transport', () => {
    const httpServers: Record<string, McpServerConfig> = {
      remote: {
        enabled: true,
        transport: 'http',
        url: 'https://mcp.example.com/api',
        headers: { Authorization: 'Bearer token' },
      },
    };

    const output = provider.generate(httpServers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers['remote']).toEqual({
      type: 'http',
      url: 'https://mcp.example.com/api',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('should preserve unrelated top-level settings during merge', () => {
    const existing = `{
  "theme": "dark",
  "mcpServers": {
    "old": {
      "type": "stdio",
      "command": "old"
    }
  }
}`;

    const output = provider.generate(servers, existing);
    const parsed = JSON.parse(output);

    expect(parsed.theme).toBe('dark');
    expect(parsed.mcpServers['jira-tvx']).toBeDefined();
    expect(parsed.mcpServers.old).toBeUndefined();
  });

  it('should support global user config merge in ~/.claude.json', () => {
    const existing = `{
  "theme": "dark",
  "projects": {
    "/tmp/project": {
      "mcpServers": {
        "local": {
          "type": "stdio",
          "command": "old"
        }
      }
    }
  }
}`;

    const output = provider.generate(servers, existing, 'global');
    const parsed = JSON.parse(output);

    expect(parsed.theme).toBe('dark');
    expect(parsed.projects['/tmp/project'].mcpServers.local.command).toBe('old');
    expect(parsed.mcpServers['jira-tvx']).toBeDefined();
  });
});
