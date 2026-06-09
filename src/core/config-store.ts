import os from 'node:os';
import path from 'node:path';
import type { McpConfigFile, McpServerConfig, ProviderName } from '../types/canonical.js';
import { readJsonFile, writeJsonFile, fileExists } from '../utils/fs.js';
import { validateConfig } from '../utils/validation.js';

export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.agents', 'mcp.json');
export const GLOBAL_CONFIG_DISPLAY_PATH = '~/.agents/mcp.json';

export class ConfigStore {
  private configPath: string;

  constructor(_projectRoot: string) {
    this.configPath = GLOBAL_CONFIG_PATH;
  }

  exists(): boolean {
    return fileExists(this.configPath);
  }

  getPath(): string {
    return this.configPath;
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

function normalizeConfig(config: McpConfigFile): McpConfigFile {
  const sortedProviders = [...config.providers].sort();
  const sortedServers = Object.fromEntries(
    Object.entries(config.servers).sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    ...config,
    providers: sortedProviders,
    servers: sortedServers,
  };
}
