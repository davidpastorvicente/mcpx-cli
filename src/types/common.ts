import type { ProviderName } from './canonical.js';

export type ConfigScope = 'project' | 'global';

export interface CommandContext {
  projectRoot: string;
  verbose: boolean;
}

export interface SyncResult {
  provider: ProviderName;
  filePath: string;
  status: 'created' | 'updated' | 'unchanged' | 'deleted' | 'error';
  error?: string;
}

export interface ImportResult {
  provider: ProviderName;
  serversFound: number;
  serversImported: string[];
}

export interface DetectionResult {
  provider: ProviderName;
  filePath: string;
  servers: string[];
}
