import { describe, it, expect } from 'vitest';
import { VscodeProvider } from '../../src/providers/vscode.js';
import type { McpServerConfig } from '../../src/types/canonical.js';

describe('VscodeProvider', () => {
  const provider = new VscodeProvider();

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

  it('should generate JSON with servers root key and stdio type', () => {
    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.servers['jira-tvx']).toEqual({
      type: 'stdio',
      command: 'uvx',
      args: ['mcp-atlassian'],
      env: { JIRA_URL: 'https://jira.example.com' },
    });

    expect(parsed.servers['github-tvx'].type).toBe('stdio');
  });

  it('should ignore disabled servers', () => {
    const output = provider.generate({
      disabled: { transport: 'stdio', command: 'test', enabled: false },
      enabled: { enabled: true, transport: 'stdio', command: 'test' },
    });
    const parsed = JSON.parse(output);

    expect(parsed.servers['disabled']).toBeUndefined();
    expect(parsed.servers['enabled']).toBeDefined();
  });

  it('should map http to sse type', () => {
    const httpServers: Record<string, McpServerConfig> = {
      remote: {
        enabled: true,
        transport: 'http',
        url: 'https://api.example.com/mcp',
        headers: { Authorization: 'Bearer token' },
      },
    };

    const output = provider.generate(httpServers);
    const parsed = JSON.parse(output);

    expect(parsed.servers['remote']).toEqual({
      type: 'sse',
      url: 'https://api.example.com/mcp',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('should parse VS Code JSON with sse as http', () => {
    const input = JSON.stringify({
      servers: {
        test: {
          type: 'sse',
          url: 'https://mcp.example.com',
        },
      },
    });

    const result = provider.parse(input);

    expect(result['test']?.transport).toBe('http');
    expect(result['test']?.enabled).toBe(true);
    expect(result['test']?.url).toBe('https://mcp.example.com');
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
    expect(provider.config.configPath).toBe('.vscode/mcp.json');
  });

  it('should preserve unrelated top-level settings during merge', () => {
    const existing = `{
  "inputs": [
    {
      "type": "promptString",
      "id": "token"
    }
  ],
  "servers": {
    "old": {
      "type": "stdio",
      "command": "old"
    }
  }
}`;

    const output = provider.generate(servers, existing);
    const parsed = JSON.parse(output);

    expect(parsed.inputs).toHaveLength(1);
    expect(parsed.servers['jira-tvx']).toBeDefined();
    expect(parsed.servers.old).toBeUndefined();
  });
});
