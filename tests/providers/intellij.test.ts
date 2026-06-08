import { describe, it, expect } from 'vitest';
import { IntellijProvider } from '../../src/providers/intellij.js';
import type { McpServerConfig } from '../../src/types/canonical.js';

describe('IntellijProvider', () => {
  const provider = new IntellijProvider();

  const servers: Record<string, McpServerConfig> = {
    'jira-tvx': {
      transport: 'stdio',
      command: 'uvx',
      args: ['mcp-atlassian'],
      env: { JIRA_URL: 'https://jira.example.com' },
    },
    'github-tvx': {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic-ai/mcp-github-server'],
      env: { GITHUB_TOKEN: 'ghp_xxx' },
    },
  };

  it('should generate JSON with mcpServers and no type field', () => {
    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers['jira-tvx']).toEqual({
      command: 'uvx',
      args: ['mcp-atlassian'],
      env: { JIRA_URL: 'https://jira.example.com' },
    });

    expect(parsed.mcpServers['jira-tvx'].type).toBeUndefined();
  });

  it('should ignore disabled servers', () => {
    const output = provider.generate({
      disabled: { transport: 'stdio', command: 'test', enabled: false },
      enabled: { transport: 'stdio', command: 'test' },
    });
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers['disabled']).toBeUndefined();
    expect(parsed.mcpServers['enabled']).toBeDefined();
  });

  it('should support http transport', () => {
    const httpServers: Record<string, McpServerConfig> = {
      remote: {
        transport: 'http',
        url: 'https://mcp.example.com/api',
        headers: { Authorization: 'Bearer token' },
      },
    };

    const output = provider.generate(httpServers);
    const parsed = JSON.parse(output);

    expect(parsed.mcpServers['remote']).toEqual({
      url: 'https://mcp.example.com/api',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('should infer transport during parse based on the presence of url', () => {
    const input = JSON.stringify({
      mcpServers: {
        local: {
          command: 'npx',
          args: ['-y', 'test-server'],
          env: { KEY: 'value' },
        },
        remote: {
          url: 'https://mcp.example.com',
        },
      },
    });

    const result = provider.parse(input);

    expect(result['local']?.transport).toBe('stdio');
    expect(result['local']?.command).toBe('npx');
    expect(result['remote']?.transport).toBe('http');
    expect(result['remote']?.url).toBe('https://mcp.example.com');
  });

  it('should roundtrip generate -> parse with the same result', () => {
    const generated = provider.generate(servers);
    const parsed = provider.parse(generated);

    expect(parsed['jira-tvx']?.command).toBe('uvx');
    expect(parsed['jira-tvx']?.args).toEqual(['mcp-atlassian']);
    expect(parsed['jira-tvx']?.transport).toBe('stdio');
  });

  it('should be a project-scoped provider with the correct configPath', () => {
    expect(provider.config.supportsProjectConfig).toBe(true);
    expect(provider.config.configPath).toBe('.idea/mcp.json');
  });
});
