import os from 'node:os';
import path from 'node:path';
import type { McpServerConfig } from '../types/canonical.js';
import type { ConfigScope } from '../types/common.js';
import type { Provider, ProviderConfig } from '../types/providers.js';
import { configExists, generateJsonConfig, getConfigFilePath, parseJsonServers } from './json-provider-utils.js';

export class AntigravityCliProvider implements Provider {
  readonly config: ProviderConfig = {
    name: 'antigravity-cli',
    displayName: 'Antigravity CLI',
    configPath: '.gemini/config/mcp_config.json',
    supportsProjectConfig: true,
    supportsGlobalConfig: true,
    globalConfigPath: path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'),
  };

  generate(servers: Record<string, McpServerConfig>, existingContent?: string): string {
    const mcpServers: Record<string, unknown> = {};

    for (const [name, server] of Object.entries(servers)) {
      if (server.transport === 'stdio') {
        mcpServers[name] = {
          ...(server.enabled === false && { disabled: true }),
          command: server.command,
          ...(server.args?.length && { args: server.args }),
          ...(server.env && Object.keys(server.env).length && { env: server.env }),
        };
      } else if (server.transport === 'http') {
        mcpServers[name] = {
          ...(server.enabled === false && { disabled: true }),
          serverUrl: server.url,
          ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
        };
      }
    }

    return generateJsonConfig('mcpServers', mcpServers, existingContent);
  }

  parse(content: string): Record<string, McpServerConfig> {
    return parseJsonServers(content, 'mcpServers', (server) => server['serverUrl'] ? 'http' : 'stdio', {
      disabledKey: 'disabled', urlKey: 'serverUrl',
    });
  }

  getConfigFilePath(projectRoot: string, scope: ConfigScope = 'project'): string {
    return getConfigFilePath(this.config, projectRoot, scope);
  }

  exists(projectRoot: string, scope: ConfigScope = 'project'): boolean {
    return configExists(this.config, projectRoot, scope);
  }
}
