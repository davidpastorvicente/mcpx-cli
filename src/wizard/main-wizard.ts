import * as p from '@clack/prompts';
import type { McpServerConfig } from '../types/canonical.js';
import { ConfigStore } from '../core/config-store.js';
import { ConfigDetector } from '../core/detector.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders, cleanupRemovedProviders } from '../core/merger.js';
import { readTextFile, ensureShellAlias } from '../utils/fs.js';
import { runServerWizard } from './server-wizard.js';
import { runProviderWizard } from './provider-wizard.js';
import { handleCancel, BACK } from './step-runner.js';

export async function runMainWizard(projectRoot: string): Promise<void> {
  const store = new ConfigStore(projectRoot);
  const registry = createRegistry();

  p.intro('MCPX - MCP server configuration');

  if (store.exists()) {
    await handleExistingConfig(store, registry, projectRoot);
    return;
  }

  await handleNewConfig(store, registry, projectRoot);
}

async function handleExistingConfig(
  store: ConfigStore,
  registry: ReturnType<typeof createRegistry>,
  projectRoot: string,
): Promise<void> {
  const config = store.load();
  const serverCount = Object.keys(config.servers).length;

  p.log.info(`Configuration found: ${serverCount} server(s), ${config.providers.length} provider(s)`);

  const action = handleCancel(
    await p.select({
      message: 'O que deseja fazer?',
      options: [
        { value: 'add', label: 'Add server' },
        { value: 'remove', label: 'Remove server' },
        { value: 'providers', label: 'Change providers' },
        { value: 'sync', label: 'Sync configs' },
        { value: 'exit', label: 'Exit' },
      ],
    }),
  );

  if (action === BACK) {
    p.outro('See you later!');
    return;
  }

  switch (action) {
    case 'add': {
      const existingNames = Object.keys(config.servers);
      const result = await runServerWizard(existingNames);
      if (!result) {
        p.cancel('Operation canceled.');
        break;
      }
      store.addServer(result.name, result.config);
      p.log.success(`Server "${result.name}" added.`);

      const updatedConfig = store.load();
      const providers = registry.getByNames(updatedConfig.providers);
      const results = syncAllProviders(providers, projectRoot, updatedConfig.servers);
      printSyncResults(results);
      break;
    }
    case 'remove': {
      const names = Object.keys(config.servers);
      if (names.length === 0) {
        p.log.info('No servers to remove.');
        break;
      }
      const toRemove = handleCancel(
        await p.select({
          message: 'Which server should be removed?',
          options: names.map((n) => ({ value: n, label: n })),
        }),
      );
      if (toRemove === BACK) break;

      const doConfirm = handleCancel(
        await p.confirm({ message: `Confirm removal of "${toRemove}"?`, initialValue: false }),
      );
      if (doConfirm === BACK || !doConfirm) break;

      store.removeServer(toRemove);
      p.log.success(`Server "${toRemove}" removed.`);

      const updatedConfig = store.load();
      const providers = registry.getByNames(updatedConfig.providers);
      const results = syncAllProviders(providers, projectRoot, updatedConfig.servers);
      printSyncResults(results);
      break;
    }
    case 'providers': {
      const newProviders = await runProviderWizard(config.providers);
      if (newProviders === BACK) break;

      const removedNames = config.providers.filter((p) => !newProviders.includes(p));
      const removedProviders = registry.getByNames(removedNames);

      store.setProviders(newProviders);
      p.log.success('Providers updated.');

      if (removedProviders.length > 0) {
        const cleanupResults = cleanupRemovedProviders(removedProviders, projectRoot);
        printSyncResults(cleanupResults);
      }

      const updatedConfig = store.load();
      const providers = registry.getByNames(updatedConfig.providers);
      const results = syncAllProviders(providers, projectRoot, updatedConfig.servers);
      printSyncResults(results);
      break;
    }
    case 'sync': {
      const providers = registry.getByNames(config.providers);
      const results = syncAllProviders(providers, projectRoot, config.servers);
      printSyncResults(results);
      break;
    }
    case 'exit':
      p.outro('See you later!');
      break;
  }
}

async function handleNewConfig(
  store: ConfigStore,
  registry: ReturnType<typeof createRegistry>,
  projectRoot: string,
): Promise<void> {
  const detector = new ConfigDetector(projectRoot, registry);
  const detections = detector.detectAll();

  let servers: Record<string, McpServerConfig> = {};

  if (detections.length > 0) {
    const lines = detections.map((det) => {
      const provider = registry.get(det.provider);
      return `${provider?.config.displayName ?? det.provider} - ${det.servers.length} server(s)`;
    });
    p.note(lines.join('\n'), 'Detected MCP configurations');

    const doImport = handleCancel(
      await p.confirm({ message: 'Import these configurations?', initialValue: true }),
    );

    if (doImport === BACK) {
      p.cancel('Operation canceled.');
      return;
    }

    if (doImport) {
      for (const det of detections) {
        const provider = registry.get(det.provider);
        if (!provider) continue;
        try {
          const content = readTextFile(provider.getConfigFilePath(projectRoot));
          const parsed = provider.parse(content);
          servers = { ...servers, ...parsed };
        } catch {
          // Ignore parse errors.
        }
      }
      p.log.success(`Imported ${Object.keys(servers).length} server(s).`);
    }
  }

  if (Object.keys(servers).length === 0) {
    p.log.step('Let\'s configure your MCP servers.');

    let addMore = true;
    while (addMore) {
      const result = await runServerWizard(Object.keys(servers));
      if (!result) {
        if (Object.keys(servers).length === 0) {
          p.cancel('Operation canceled.');
          return;
        }
        break;
      }
      servers[result.name] = result.config;
      p.log.success(`Server "${result.name}" added.`);

      const more = handleCancel(
        await p.confirm({ message: 'Add another server?', initialValue: false }),
      );
      if (more === BACK) break;
      addMore = more as boolean;
    }
  }

  const providers = await runProviderWizard();
  if (providers === BACK) {
    p.cancel('Operation canceled.');
    return;
  }

  if (providers.length === 0) {
    p.log.warn('No providers selected.');
  }

  const serverList = Object.keys(servers).join(', ');
  const providerList = providers.map((pn) => registry.get(pn)?.config.displayName ?? pn).join(', ') || 'none';
  p.note(`Servers: ${serverList}\nProviders: ${providerList}`, 'Summary');

  const doConfirm = handleCancel(
    await p.confirm({ message: 'Confirm and generate files?', initialValue: true }),
  );

  if (doConfirm === BACK || !doConfirm) {
    p.cancel('Operation canceled.');
    return;
  }

  store.save({ version: 1, providers, servers });
  p.log.success('Created: .mcpx.json');

  if (providers.length > 0) {
    const providerInstances = registry.getByNames(providers);
    const results = syncAllProviders(providerInstances, projectRoot, servers);
    printSyncResults(results);
  }

  p.outro('Configuration complete!');
}

function printSyncResults(
  results: Array<{ provider: string; filePath: string; status: string; error?: string }>,
): void {
  for (const result of results) {
    switch (result.status) {
      case 'created':
        p.log.success(`Created: ${result.filePath}`);
        break;
      case 'updated':
        p.log.success(`Updated: ${result.filePath}`);
        break;
      case 'deleted':
        p.log.warn(`Removed: ${result.filePath}`);
        break;
      case 'error':
        p.log.error(`${result.filePath}: ${result.error}`);
        break;
    }
  }

  if (results.some((r) => r.provider === 'copilot-cli' && r.status !== 'error')) {
    if (ensureShellAlias('copilot', 'copilot --additional-mcp-config @.copilot/mcp-config.json')) {
      p.log.success('Configured the "copilot" shell alias (run "source ~/.zshrc" or restart the terminal).');
    }
  }
}
