import type { ProviderName } from '../types/canonical.js';
import type { Provider } from '../types/providers.js';
import { ClaudeCodeProvider } from './claude-code.js';
import { AntigravityCliProvider } from './antigravity-cli.js';
import { KimiCliProvider } from './kimi-cli.js';
import { OpenAICodexProvider } from './openai-codex.js';
import { OpenCodeProvider } from './opencode.js';
import { CopilotCliProvider } from './copilot-cli.js';
import { VscodeProvider } from './vscode.js';
import { IntellijProvider } from './intellij.js';

export class ProviderRegistry {
  private providers = new Map<ProviderName, Provider>();

  register(provider: Provider): void {
    this.providers.set(provider.config.name, provider);
  }

  get(name: ProviderName): Provider | undefined {
    return this.providers.get(name);
  }

  getAll(): Provider[] {
    return Array.from(this.providers.values());
  }

  getByNames(names: ProviderName[]): Provider[] {
    return names
      .map((n) => this.providers.get(n))
      .filter((p): p is Provider => p !== undefined);
  }
}

export function createRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new ClaudeCodeProvider());
  registry.register(new AntigravityCliProvider());
  registry.register(new KimiCliProvider());
  registry.register(new OpenAICodexProvider());
  registry.register(new OpenCodeProvider());
  registry.register(new CopilotCliProvider());
  registry.register(new VscodeProvider());
  registry.register(new IntellijProvider());
  return registry;
}
