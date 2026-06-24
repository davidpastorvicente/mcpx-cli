import nodePath from 'node:path';
import type { McpServerConfig } from '../types/canonical.js';
import type { Provider } from '../types/providers.js';
import type { ConfigScope, SyncResult } from '../types/common.js';
import { readTextFile, writeTextFile, fileExists, deleteFile } from '../utils/fs.js';

export function syncProvider(
  provider: Provider,
  projectRoot: string,
  servers: Record<string, McpServerConfig>,
  scope: ConfigScope,
): SyncResult {
  const filePath = provider.getConfigFilePath(projectRoot, scope);
  const newContent = provider.generate(servers, undefined, scope, projectRoot);

  try {
    if (fileExists(filePath)) {
      const currentContent = readTextFile(filePath);
      const mergedContent = provider.generate(servers, currentContent, scope, projectRoot);
      if (currentContent === mergedContent) {
        return { provider: provider.config.name, filePath, status: 'unchanged' };
      }
      writeTextFile(filePath, mergedContent);
      return { provider: provider.config.name, filePath, status: 'updated' };
    }

    writeTextFile(filePath, newContent);
    return { provider: provider.config.name, filePath, status: 'created' };
  } catch (err) {
    return {
      provider: provider.config.name,
      filePath,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function syncAllProviders(
  providers: Provider[],
  projectRoot: string,
  servers: Record<string, McpServerConfig>,
  scope: ConfigScope,
): SyncResult[] {
  return providers.map((provider) => syncProvider(provider, projectRoot, servers, scope));
}

export function cleanupRemovedProviders(
  removedProviders: Provider[],
  projectRoot: string,
  scope: ConfigScope,
): SyncResult[] {
  const results: SyncResult[] = [];

  for (const provider of removedProviders) {
    const filePath = provider.getConfigFilePath(projectRoot, scope);
    try {
      if (deleteFile(filePath)) {
        results.push({ provider: provider.config.name, filePath, status: 'deleted' });
      }
    } catch (err) {
      results.push({
        provider: provider.config.name,
        filePath,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (scope === 'global' && provider.config.globalConfigPath && !provider.config.supportsProjectConfig) {
      const projectFilePath = nodePath.join(projectRoot, provider.config.configPath);
      try {
        if (deleteFile(projectFilePath)) {
          results.push({ provider: provider.config.name, filePath: projectFilePath, status: 'deleted' });
        }
      } catch {
        // Ignore cleanup errors for legacy files.
      }
    }
  }

  return results;
}
