import os from 'node:os';
import path from 'node:path';
import type { McpServerConfig } from '../types/canonical.js';
import type { Provider, ProviderConfig } from '../types/providers.js';
import { fileExists } from '../utils/fs.js';
import { parseJsonLike, updateJsonLikeTopLevelSection } from '../utils/json-like.js';

export class CopilotCliProvider implements Provider {
  readonly config: ProviderConfig = {
    name: 'copilot-cli',
    displayName: 'Copilot CLI',
    configPath: '.copilot/mcp-config.json',
    supportsProjectConfig: false,
    globalConfigPath: path.join(os.homedir(), '.copilot', 'mcp-config.json'),
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
          type: 'http',
          url: server.url,
          ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
        };
      }
    }

    if (existingContent) {
      try {
        return updateJsonLikeTopLevelSection(existingContent, 'mcpServers', mcpServers);
      } catch {
        // Fall back to generating a fresh file.
      }
    }

    return JSON.stringify({ mcpServers }, null, 2) + '\n';
  }

  parse(content: string): Record<string, McpServerConfig> {
    const data = parseJsonLike(content) as { mcpServers?: Record<string, Record<string, unknown>> };
    const servers: Record<string, McpServerConfig> = {};

    for (const [name, raw] of Object.entries(data.mcpServers ?? {})) {
      const server: McpServerConfig = {
        transport: raw['type'] === 'http' ? 'http' : 'stdio',
      };
      if (raw['command']) server.command = raw['command'] as string;
      if (raw['args']) server.args = raw['args'] as string[];
      if (raw['env']) server.env = raw['env'] as Record<string, string>;
      if (raw['url']) server.url = raw['url'] as string;
      if (raw['headers']) server.headers = raw['headers'] as Record<string, string>;
      servers[name] = server;
    }

    return servers;
  }

  getConfigFilePath(projectRoot: string): string {
    if (this.config.globalConfigPath) {
      return this.config.globalConfigPath;
    }

    return path.join(projectRoot, this.config.configPath);
  }

  exists(projectRoot: string): boolean {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
}
