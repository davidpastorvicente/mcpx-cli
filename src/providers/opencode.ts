import os from 'node:os';
import path from 'node:path';
import type { McpServerConfig } from '../types/canonical.js';
import type { ConfigScope } from '../types/common.js';
import type { Provider, ProviderConfig } from '../types/providers.js';
import { fileExists } from '../utils/fs.js';
import { parseJsonLike } from '../utils/json-like.js';

const OPEN_CODE_DIR = path.join(os.homedir(), '.config', 'opencode');
const OPEN_CODE_JSONC_PATH = path.join(OPEN_CODE_DIR, 'opencode.jsonc');
const OPEN_CODE_JSON_PATH = path.join(OPEN_CODE_DIR, 'opencode.json');

export class OpenCodeProvider implements Provider {
  readonly config: ProviderConfig = {
    name: 'opencode',
    displayName: 'OpenCode',
    configPath: 'opencode.json',
    supportsProjectConfig: true,
    supportsGlobalConfig: true,
    globalConfigPath: OPEN_CODE_JSONC_PATH,
  };

  generate(servers: Record<string, McpServerConfig>): string {
    const mcp: Record<string, unknown> = {};

    for (const [name, server] of Object.entries(servers)) {
      if (server.transport === 'stdio') {
        const command = [server.command, ...(server.args ?? [])];
        mcp[name] = {
          enabled: server.enabled !== false,
          type: 'local',
          command,
          ...(server.env && Object.keys(server.env).length && { environment: server.env }),
        };
      } else if (server.transport === 'http') {
        mcp[name] = {
          enabled: server.enabled !== false,
          type: 'remote',
          url: server.url,
          ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
        };
      }
    }

    return JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp }, null, 2) + '\n';
  }

  parse(content: string): Record<string, McpServerConfig> {
    const data = parseJsonLike(content) as { mcp?: Record<string, Record<string, unknown>> };
    const servers: Record<string, McpServerConfig> = {};

    for (const [name, raw] of Object.entries(data.mcp ?? {})) {
      const commandArray = raw['command'] as string[] | undefined;
      const cmd = commandArray?.[0];
      const args = commandArray?.slice(1);

      const server: McpServerConfig = {
        enabled: raw['enabled'] !== false,
        transport: raw['type'] === 'remote' ? 'http' : 'stdio',
      };
      if (cmd) server.command = cmd;
      if (args?.length) server.args = args;
      if (raw['environment']) server.env = raw['environment'] as Record<string, string>;
      if (raw['url']) server.url = raw['url'] as string;
      if (raw['headers']) server.headers = raw['headers'] as Record<string, string>;
      servers[name] = server;
    }

    return servers;
  }

  getConfigFilePath(projectRoot: string, scope: ConfigScope = 'project'): string {
    if (scope === 'project') {
      return path.join(projectRoot, this.config.configPath);
    }

    if (fileExists(OPEN_CODE_JSONC_PATH)) {
      return OPEN_CODE_JSONC_PATH;
    }

    if (fileExists(OPEN_CODE_JSON_PATH)) {
      return OPEN_CODE_JSON_PATH;
    }

    return OPEN_CODE_JSONC_PATH;
  }

  exists(projectRoot: string, scope: ConfigScope = 'project'): boolean {
    return fileExists(this.getConfigFilePath(projectRoot, scope));
  }
}
