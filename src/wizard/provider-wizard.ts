import * as p from '@clack/prompts';
import type { ProviderName } from '../types/canonical.js';
import type { ConfigScope } from '../types/common.js';
import { PROVIDER_NAMES } from '../types/canonical.js';
import { createRegistry } from '../providers/registry.js';
import { handleCancel, BACK, type BackSignal } from './step-runner.js';

const PROVIDER_DETAILS: Record<ProviderName, { project: string; global?: string; hint?: string }> = {
  'claude-code': { project: '.mcp.json', global: '~/.claude.json' },
  'antigravity-cli': { project: '.gemini/config/mcp_config.json', global: '~/.gemini/config/mcp_config.json' },
  'kimi-cli': { project: '.kimi-code/mcp.json', global: '~/.kimi-code/mcp.json' },
  'openai-codex': { project: '.codex/config.toml', global: '~/.codex/config.toml' },
  'opencode': { project: 'opencode.json', global: '~/.config/opencode/opencode.jsonc', hint: 'global falls back to opencode.json' },
  'copilot-cli': { project: '.copilot/mcp-config.json', global: '~/.copilot/mcp-config.json' },
  'vscode': { project: '.vscode/mcp.json' },
  'intellij': { project: '.idea/mcp.json' },
};

export async function runProviderWizard(
  preSelected: ProviderName[] = [],
  scope: ConfigScope = 'project',
): Promise<ProviderName[] | BackSignal> {
  const registry = createRegistry();
  const providerNames = PROVIDER_NAMES.filter((name) => {
    const provider = registry.get(name);
    return scope === 'project' ? provider?.config.supportsProjectConfig : provider?.config.supportsGlobalConfig;
  });

  const result = handleCancel(
    await p.multiselect({
      message: 'Select the providers to generate configuration for',
      options: providerNames.map((name) => {
        const provider = registry.get(name);
        const details = PROVIDER_DETAILS[name];
        const detailPath = scope === 'project' ? details.project : details.global ?? details.project;
        return {
          value: name,
          label: `${provider?.config.displayName ?? name}`,
          hint: `${detailPath}${details?.hint ? ` (${details.hint})` : ''}`,
        };
      }),
      initialValues: preSelected.filter((name) => providerNames.includes(name)),
    }),
  );

  if (result === BACK) return BACK;
  return result;
}
