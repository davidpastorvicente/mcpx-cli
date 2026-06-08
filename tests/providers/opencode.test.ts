import { describe, it, expect } from 'vitest';
import { OpenCodeProvider } from '../../src/providers/opencode.js';
import type { McpServerConfig } from '../../src/types/canonical.js';

describe('OpenCodeProvider', () => {
  const provider = new OpenCodeProvider();

  it('should generate JSON with command as an array and environment', () => {
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

    expect(parsed.$schema).toBe('https://opencode.ai/config.json');
    expect(parsed.mcp.test).toEqual({
      type: 'local',
      command: ['npx', '-y', 'test-server'],
      environment: { KEY: 'value' },
      enabled: true,
    });
  });

  it('should parse by splitting command array into command + args', () => {
    const input = JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        test: {
          type: 'local',
          command: ['uvx', 'mcp-atlassian'],
          environment: { JIRA_URL: 'https://jira.example.com' },
          enabled: true,
        },
      },
    });

    const result = provider.parse(input);

    expect(result['test']?.command).toBe('uvx');
    expect(result['test']?.args).toEqual(['mcp-atlassian']);
    expect(result['test']?.env).toEqual({ JIRA_URL: 'https://jira.example.com' });
    expect(result['test']?.transport).toBe('stdio');
  });

  it('should support remote type as http', () => {
    const servers: Record<string, McpServerConfig> = {
      remote: {
        transport: 'http',
        url: 'https://mcp.example.com',
        headers: { Auth: 'Bearer token' },
      },
    };

    const output = provider.generate(servers);
    const parsed = JSON.parse(output);

    expect(parsed.mcp.remote.type).toBe('remote');
    expect(parsed.mcp.remote.url).toBe('https://mcp.example.com');
  });
});
