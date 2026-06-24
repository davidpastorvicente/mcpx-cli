import type { DetectionResult } from '../types/common.js';
import type { ConfigScope } from '../types/common.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { readTextFile } from '../utils/fs.js';

export class ConfigDetector {
  constructor(
    private projectRoot: string,
    private registry: ProviderRegistry,
    private scope: ConfigScope = 'project',
  ) {}

  detectAll(): DetectionResult[] {
    const results: DetectionResult[] = [];

    for (const provider of this.registry.getAll()) {
      if (this.scope === 'project' && !provider.config.supportsProjectConfig) continue;
      if (this.scope === 'global' && !provider.config.supportsGlobalConfig) continue;
      if (!provider.exists(this.projectRoot, this.scope)) continue;

      try {
        const content = readTextFile(provider.getConfigFilePath(this.projectRoot, this.scope));
        const servers = provider.parse(content);
        results.push({
          provider: provider.config.name,
          filePath: provider.getConfigFilePath(this.projectRoot, this.scope),
          servers: Object.keys(servers),
        });
      } catch {
        // Ignore files that exist but cannot be parsed.
      }
    }

    return results;
  }
}
