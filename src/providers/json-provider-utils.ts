import path from 'node:path';
import type { McpServerConfig } from '../types/canonical.js';
import type { ConfigScope } from '../types/common.js';
import type { ProviderConfig } from '../types/providers.js';
import { fileExists } from '../utils/fs.js';
import { parseJsonLike, updateJsonLikeTopLevelSection } from '../utils/json-like.js';

type RawServers = Record<string, Record<string, unknown>>;

export function generateJsonConfig(section: string, servers: Record<string, unknown>, existingContent?: string): string {
  if (existingContent) {
    try {
      return updateJsonLikeTopLevelSection(existingContent, section, servers);
    } catch {
      // Fall back to generating a fresh file.
    }
  }

  return JSON.stringify({ [section]: servers }, null, 2) + '\n';
}

export function parseJsonServers(
  content: string,
  section: string,
  getTransport: (server: Record<string, unknown>) => McpServerConfig['transport'],
  options: { disabledKey?: string; urlKey?: string; headersKey?: string } = {},
): Record<string, McpServerConfig> {
  const data = parseJsonLike(content) as Record<string, RawServers | undefined>;
  const servers: Record<string, McpServerConfig> = {};
  const { disabledKey, urlKey = 'url', headersKey = 'headers' } = options;

  for (const [name, raw] of Object.entries(data[section] ?? {})) {
    const server: McpServerConfig = {
      enabled: disabledKey ? raw[disabledKey] !== true : true,
      transport: getTransport(raw),
    };
    if (raw['command']) server.command = raw['command'] as string;
    if (raw['args']) server.args = raw['args'] as string[];
    if (raw['env']) server.env = raw['env'] as Record<string, string>;
    if (raw[urlKey]) server.url = raw[urlKey] as string;
    if (raw[headersKey]) server.headers = raw[headersKey] as Record<string, string>;
    servers[name] = server;
  }

  return servers;
}

export function getConfigFilePath(config: ProviderConfig, projectRoot: string, scope: ConfigScope = 'project'): string {
  return scope === 'global' && config.globalConfigPath
    ? config.globalConfigPath
    : path.join(projectRoot, config.configPath);
}

export function configExists(config: ProviderConfig, projectRoot: string, scope: ConfigScope = 'project'): boolean {
  if (scope === 'global' && !config.supportsGlobalConfig) return false;
  if (scope === 'project' && !config.supportsProjectConfig) return false;
  return fileExists(getConfigFilePath(config, projectRoot, scope));
}
