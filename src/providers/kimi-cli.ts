import os from 'node:os';
import path from 'node:path';
import type { McpServerConfig } from '../types/canonical.js';
import type { ConfigScope } from '../types/common.js';
import type { Provider, ProviderConfig } from '../types/providers.js';
import { configExists, generateJsonConfig, getConfigFilePath, parseJsonServers } from './json-provider-utils.js';

export class KimiCliProvider implements Provider {
  readonly config: ProviderConfig = {
    name: 'kimi-cli',
    displayName: 'Kimi CLI',
    configPath: '.kimi-code/mcp.json',
    supportsProjectConfig: true,
    supportsGlobalConfig: true,
    globalConfigPath: path.join(process.env['KIMI_CODE_HOME'] ?? path.join(os.homedir(), '.kimi-code'), 'mcp.json'),
  };

  generate(servers: Record<string, McpServerConfig>, existingContent?: string): string {
    const mcpServers: Record<string, unknown> = {};

    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;

      if (server.transport === 'stdio') {
        mcpServers[name] = {
          command: server.command,
          ...(server.args?.length && { args: server.args }),
          ...(server.env && Object.keys(server.env).length && { env: server.env }),
        };
      } else if (server.transport === 'http') {
        mcpServers[name] = {
          url: server.url,
          ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
        };
      }
    }

    return generateJsonConfig('mcpServers', mcpServers, existingContent);
  }

  parse(content: string): Record<string, McpServerConfig> {
    return parseJsonServers(content, 'mcpServers', (server) => server['url'] ? 'http' : 'stdio');
  }

  getConfigFilePath(projectRoot: string, scope: ConfigScope = 'project'): string {
    return getConfigFilePath(this.config, projectRoot, scope);
  }

  exists(projectRoot: string, scope: ConfigScope = 'project'): boolean {
    return configExists(this.config, projectRoot, scope);
  }
}
