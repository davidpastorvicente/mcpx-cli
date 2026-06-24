import type { McpServerConfig, ProviderName } from './canonical.js';
import type { ConfigScope } from './common.js';

export interface ProviderConfig {
  name: ProviderName;
  displayName: string;
  configPath: string;
  supportsProjectConfig: boolean;
  supportsGlobalConfig: boolean;
  globalConfigPath?: string;
}

export interface Provider {
  readonly config: ProviderConfig;
  generate(servers: Record<string, McpServerConfig>, existingContent?: string, scope?: ConfigScope, projectRoot?: string): string;
  parse(content: string): Record<string, McpServerConfig>;
  getConfigFilePath(projectRoot: string, scope?: ConfigScope): string;
  exists(projectRoot: string, scope?: ConfigScope): boolean;
}
