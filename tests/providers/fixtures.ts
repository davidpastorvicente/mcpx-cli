import type { McpServerConfig } from '../../src/types/canonical.js';

export const standardServers: Record<string, McpServerConfig> = {
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
