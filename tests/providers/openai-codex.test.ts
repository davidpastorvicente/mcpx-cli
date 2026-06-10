import { describe, it, expect } from 'vitest';
import { OpenAICodexProvider } from '../../src/providers/openai-codex.js';
import type { McpServerConfig } from '../../src/types/canonical.js';

describe('OpenAICodexProvider', () => {
  const provider = new OpenAICodexProvider();

  it('should generate TOML with mcp_servers', () => {
    const servers: Record<string, McpServerConfig> = {
      test: {
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'test-server'],
        env: { KEY: 'value' },
      },
    };

    const output = provider.generate(servers);

    expect(output).toContain('[mcp_servers.test]');
    expect(output).toContain('command = "npx"');
    expect(output).toContain('args = [ "-y", "test-server" ]');
  });

  it('should parse TOML', () => {
    const toml = `[mcp_servers.github]
command = "npx"
args = ["-y", "@anthropic-ai/mcp-github-server"]

[mcp_servers.github.env]
GITHUB_TOKEN = "ghp_xxx"
`;

    const result = provider.parse(toml);

    expect(result['github']?.command).toBe('npx');
    expect(result['github']?.enabled).toBe(true);
    expect(result['github']?.args).toEqual(['-y', '@anthropic-ai/mcp-github-server']);
    expect(result['github']?.env).toEqual({ GITHUB_TOKEN: 'ghp_xxx' });
    expect(result['github']?.transport).toBe('stdio');
  });

  it('should roundtrip generate -> parse', () => {
    const servers: Record<string, McpServerConfig> = {
      jira: {
        enabled: true,
        transport: 'stdio',
        command: 'uvx',
        args: ['mcp-atlassian'],
        env: { JIRA_URL: 'https://jira.example.com' },
      },
    };

    const generated = provider.generate(servers);
    const parsed = provider.parse(generated);

    expect(parsed['jira']?.command).toBe('uvx');
    expect(parsed['jira']?.args).toEqual(['mcp-atlassian']);
    expect(parsed['jira']?.env).toEqual({ JIRA_URL: 'https://jira.example.com' });
  });

  it('should preserve existing settings during merge', () => {
    const existingToml = `model = "o4-mini"
approval_mode = "suggest"

[mcp_servers.old-server]
command = "npx"
args = ["-y", "old-mcp-server"]
`;

    const servers: Record<string, McpServerConfig> = {
      'new-server': {
        enabled: true,
        transport: 'stdio',
        command: 'uvx',
        args: ['new-mcp-server'],
        env: { API_KEY: 'test' },
      },
    };

    const output = provider.generate(servers, existingToml);

    expect(output).toContain('model = "o4-mini"');
    expect(output).toContain('approval_mode = "suggest"');
    expect(output).toContain('[mcp_servers.new-server]');
    expect(output).toContain('command = "uvx"');
    expect(output).not.toContain('old-server');
  });

  it('should generate from scratch when existingContent is invalid', () => {
    const servers: Record<string, McpServerConfig> = {
      test: {
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'test-server'],
      },
    };

    const output = provider.generate(servers, 'invalid toml {{{{');

    expect(output).toContain('[mcp_servers.test]');
    expect(output).toContain('command = "npx"');
  });
});
