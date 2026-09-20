import type { McpServerConfig } from '../types/canonical.js';
import type { ConfigScope } from '../types/common.js';
import type { Provider, ProviderConfig } from '../types/providers.js';
import { configExists, generateJsonConfig, getConfigFilePath, parseJsonServers } from './json-provider-utils.js';

export class VscodeProvider implements Provider {
  readonly config: ProviderConfig = {
    name: 'vscode',
    displayName: 'VS Code',
    configPath: '.vscode/mcp.json',
    supportsProjectConfig: true,
    supportsGlobalConfig: false,
  };

  generate(servers: Record<string, McpServerConfig>, existingContent?: string): string {
    const vscodeServers: Record<string, unknown> = {};

    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;

      if (server.transport === 'stdio') {
        vscodeServers[name] = {
          type: 'stdio',
          command: server.command,
          ...(server.args?.length && { args: server.args }),
          ...(server.env && Object.keys(server.env).length && { env: server.env }),
        };
      } else if (server.transport === 'http') {
        vscodeServers[name] = {
          type: 'sse',
          url: server.url,
          ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
        };
      }
    }

    return generateJsonConfig('servers', vscodeServers, existingContent);
  }

  parse(content: string): Record<string, McpServerConfig> {
    return parseJsonServers(content, 'servers', (server) => server['type'] === 'sse' ? 'http' : 'stdio');
  }

  getConfigFilePath(projectRoot: string): string {
    return getConfigFilePath(this.config, projectRoot);
  }

  exists(projectRoot: string, scope: ConfigScope = 'project'): boolean {
    return configExists(this.config, projectRoot, scope);
  }
}
