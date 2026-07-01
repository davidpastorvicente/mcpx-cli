import os from 'node:os';
import path from 'node:path';
import type { McpConfigFile, McpServerConfig, ProviderName } from '../types/canonical.js';
import type { ConfigScope } from '../types/common.js';
import { readJsonFile, writeJsonFile, fileExists } from '../utils/fs.js';
import { validateConfig } from '../utils/validation.js';

export const GLOBAL_CONFIG_DISPLAY_PATH = '~/.agents/mcp.json';
export const PROJECT_CONFIG_DISPLAY_PATH = '.agents/mcp.json';

export function getGlobalConfigPath(): string {
  return path.join(os.homedir(), '.agents', 'mcp.json');
}

export function getProjectConfigPath(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_CONFIG_DISPLAY_PATH);
}

export class ConfigStore {
  private configPath: string;
  readonly scope: ConfigScope;

  constructor(projectRoot: string, scope?: ConfigScope) {
    this.scope = scope ?? detectConfigScope(projectRoot);
    this.configPath = this.scope === 'project' ? getProjectConfigPath(projectRoot) : getGlobalConfigPath();
  }

  exists(): boolean {
    return fileExists(this.configPath);
  }

  getPath(): string {
    return this.configPath;
  }

  getDisplayPath(): string {
    return this.scope === 'project' ? PROJECT_CONFIG_DISPLAY_PATH : GLOBAL_CONFIG_DISPLAY_PATH;
  }

  load(): McpConfigFile {
    const raw = readJsonFile<unknown>(this.configPath);
    return validateConfig(raw);
  }

  save(config: McpConfigFile): void {
    writeJsonFile(this.configPath, normalizeConfig(config));
  }

  createEmpty(providers: ProviderName[] = []): McpConfigFile {
    const config: McpConfigFile = {
      version: 1,
      providers,
      servers: {},
    };
    this.save(config);
    return config;
  }

  addServer(name: string, server: McpServerConfig): McpConfigFile {
    const config = this.load();
    config.servers[name] = server;
    this.save(config);
    return config;
  }

  removeServer(name: string): McpConfigFile {
    const config = this.load();
    delete config.servers[name];
    this.save(config);
    return config;
  }

  setProviders(providers: ProviderName[]): McpConfigFile {
    const config = this.load();
    config.providers = providers;
    this.save(config);
    return config;
  }

  getServers(): Record<string, McpServerConfig> {
    return this.load().servers;
  }

  getProviders(): ProviderName[] {
    return this.load().providers;
  }
}

function detectConfigScope(projectRoot: string): ConfigScope {
  if (path.resolve(projectRoot) === path.resolve(os.homedir())) return 'global';
  if (fileExists(getProjectConfigPath(projectRoot))) return 'project';
  if (fileExists(getGlobalConfigPath())) return 'global';
  return 'project';
}

function normalizeConfig(config: McpConfigFile): McpConfigFile {
  const sortedProviders = [...config.providers].sort();
  const sortedServers = Object.fromEntries(
    Object.entries(config.servers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, server]) => [name, normalizeServer(server)]),
  );

  return {
    ...config,
    providers: sortedProviders,
    servers: sortedServers,
  };
}

function normalizeServer(server: McpServerConfig): McpServerConfig {
  return {
    enabled: server.enabled,
    transport: server.transport,
    ...(server.url !== undefined && { url: server.url }),
    ...(server.headers !== undefined && { headers: server.headers }),
    ...(server.command !== undefined && { command: server.command }),
    ...(server.args !== undefined && { args: server.args }),
    ...(server.env !== undefined && { env: server.env }),
  };
}
