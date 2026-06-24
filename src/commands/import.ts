import * as p from '@clack/prompts';
import type { CommandContext } from '../types/common.js';
import type { ProviderName } from '../types/canonical.js';
import { ConfigStore } from '../core/config-store.js';
import { ConfigDetector } from '../core/detector.js';
import { createRegistry } from '../providers/registry.js';
import { syncAllProviders } from '../core/merger.js';
import { readTextFile } from '../utils/fs.js';
import { handleCancel, BACK } from '../wizard/step-runner.js';

export async function importCommand(ctx: CommandContext, providerArg?: string): Promise<void> {
  const store = new ConfigStore(ctx.projectRoot);
  const registry = createRegistry();
  const detector = new ConfigDetector(ctx.projectRoot, registry, store.scope);

  const detections = detector.detectAll();

  if (detections.length === 0) {
    p.log.info('No existing MCP configuration detected in this directory.');
    return;
  }

  const lines = detections.map((det) => {
    const provider = registry.get(det.provider);
    return `${provider?.config.displayName ?? det.provider} (${det.filePath}) - ${det.servers.length} server(s)`;
  });
  p.note(lines.join('\n'), 'Detected configurations');

  let selectedProvider: string;

  if (providerArg) {
    selectedProvider = providerArg;
  } else {
      const result = handleCancel(
      await p.select({
        message: 'Which provider should be imported?',
        options: detections.map((d) => {
          const provider = registry.get(d.provider);
          return {
            value: d.provider,
            label: provider?.config.displayName ?? d.provider,
            hint: `${d.servers.length} servers`,
          };
        }),
      }),
    );
    if (result === BACK) return;
    selectedProvider = result;
  }

  const provider = registry.get(selectedProvider as ProviderName);
  if (!provider) {
    p.log.error(`Provider "${selectedProvider}" not found.`);
    return;
  }

  const content = readTextFile(provider.getConfigFilePath(ctx.projectRoot, store.scope));
  const parsedServers = provider.parse(content);
  const serverNames = Object.keys(parsedServers);

  if (serverNames.length === 0) {
    p.log.info('No servers found in that provider.');
    return;
  }

  const selectedServers = handleCancel(
    await p.multiselect({
      message: 'Which servers should be imported?',
      options: serverNames.map((name) => ({ value: name, label: name })),
      initialValues: serverNames,
    }),
  );

  if (selectedServers === BACK || selectedServers.length === 0) {
    p.log.info('No servers selected.');
    return;
  }

  if (!store.exists()) {
    store.createEmpty();
  }

  const config = store.load();

  for (const name of selectedServers) {
    const server = parsedServers[name];
    if (server) {
      config.servers[name] = server;
    }
  }

  store.save(config);
  p.log.success(`Imported ${selectedServers.length} server(s) into ${store.getDisplayPath()}`);

  if (config.providers.length > 0) {
    const doSync = handleCancel(
      await p.confirm({ message: 'Sync with the configured providers now?', initialValue: true }),
    );

    if (doSync && doSync !== BACK) {
      const providers = registry
        .getByNames(config.providers)
        .filter((provider) => store.scope === 'project' ? provider.config.supportsProjectConfig : provider.config.supportsGlobalConfig);
      const results = syncAllProviders(providers, ctx.projectRoot, config.servers, store.scope);
      for (const result of results) {
        if (result.status === 'error') {
          p.log.error(`${result.filePath}: ${result.error}`);
        } else if (result.status !== 'unchanged') {
          p.log.success(`${result.status === 'created' ? 'Created' : 'Updated'}: ${result.filePath}`);
        }
      }
    }
  }
}
