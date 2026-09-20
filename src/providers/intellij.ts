import type { McpServerConfig } from '../types/canonical.js';
import type { ConfigScope } from '../types/common.js';
import type { Provider, ProviderConfig } from '../types/providers.js';
import {
  configExists,
  generateJsonConfig,
  generateStandardJsonServers,
  getConfigFilePath,
  parseJsonServers,
} from './json-provider-utils.js';

export class IntellijProvider implements Provider {
  readonly config: ProviderConfig = {
    name: 'intellij',
    displayName: 'IntelliJ IDEA',
    configPath: '.idea/mcp.json',
    supportsProjectConfig: true,
    supportsGlobalConfig: false,
  };

  generate(servers: Record<string, McpServerConfig>, existingContent?: string): string {
    return generateJsonConfig('mcpServers', generateStandardJsonServers(servers), existingContent);
  }

  parse(content: string): Record<string, McpServerConfig> {
    return parseJsonServers(content, 'mcpServers', (server) => server['url'] ? 'http' : 'stdio');
  }

  getConfigFilePath(projectRoot: string): string {
    return getConfigFilePath(this.config, projectRoot);
  }

  exists(projectRoot: string, scope: ConfigScope = 'project'): boolean {
    return configExists(this.config, projectRoot, scope);
  }
}
