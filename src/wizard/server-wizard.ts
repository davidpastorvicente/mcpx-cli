import * as p from '@clack/prompts';
import type { McpServerConfig } from '../types/canonical.js';
import { isValidServerName } from '../utils/validation.js';
import { handleCancel, BACK, runSteps, type Step } from './step-runner.js';

export interface ServerWizardResult {
  name: string;
  config: McpServerConfig;
}

interface ServerState {
  name: string;
  transport: 'stdio' | 'http';
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
}

export async function runServerWizard(existingNames: string[] = []): Promise<ServerWizardResult | null> {
  const stepName: Step<ServerState> = async () => {
    const result = handleCancel(
      await p.text({
        message: 'MCP server name',
        placeholder: 'ex: github, jira, my-server',
        validate: (v) => {
          const value = v?.trim() ?? '';
          if (!value) return 'Name is required';
          if (!isValidServerName(value))
            return 'Use letters, numbers, dots, hyphens, or underscores';
          if (existingNames.includes(value)) return `"${value}" already exists`;
        },
      }),
    );
    if (result === BACK) return BACK;
    return { name: (result as string).trim() };
  };

  const stepTransport: Step<ServerState> = async () => {
    const result = handleCancel(
      await p.select({
        message: 'Transport type',
        options: [
          { value: 'stdio' as const, label: 'stdio', hint: 'local command' },
          { value: 'http' as const, label: 'http', hint: 'remote server' },
        ],
      }),
    );
    if (result === BACK) return BACK;
    return { transport: result };
  };

  const stepStdioCommand: Step<ServerState> = async (state) => {
    if (state.transport !== 'stdio') return {};

    const cmd = handleCancel(
      await p.text({ message: 'Command', placeholder: 'ex: npx, uvx, docker' }),
    );
    if (cmd === BACK) return BACK;

    const argsStr = handleCancel(
      await p.text({
        message: 'Arguments',
        placeholder: 'comma-separated, leave empty for none',
        initialValue: '',
      }),
    );
    if (argsStr === BACK) return BACK;

    const args = (argsStr as string)
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    return { command: cmd as string, args };
  };

  const stepStdioEnv: Step<ServerState> = async (state) => {
    if (state.transport !== 'stdio') return {};

    const env: Record<string, string> = {};
    const shouldAdd = handleCancel(
      await p.confirm({ message: 'Add environment variables?', initialValue: false }),
    );
    if (shouldAdd === BACK) return BACK;

    if (shouldAdd) {
      let addMore = true;
      while (addMore) {
        const key = handleCancel(
          await p.text({ message: 'Variable name', placeholder: 'ex: API_KEY' }),
        );
        if (key === BACK) break;

        const value = handleCancel(
          await p.text({ message: `Value for ${key}` }),
        );
        if (value === BACK) break;

        env[key as string] = value as string;

        const more = handleCancel(
          await p.confirm({ message: 'Add another variable?', initialValue: false }),
        );
        if (more === BACK) break;
        addMore = more as boolean;
      }
    }

    return { env };
  };

  const stepHttpUrl: Step<ServerState> = async (state) => {
    if (state.transport !== 'http') return {};

    const url = handleCancel(
      await p.text({ message: 'Server URL', placeholder: 'https://mcp.example.com/api' }),
    );
    if (url === BACK) return BACK;
    return { url: url as string };
  };

  const stepHttpHeaders: Step<ServerState> = async (state) => {
    if (state.transport !== 'http') return {};

    const headers: Record<string, string> = {};
    const shouldAdd = handleCancel(
      await p.confirm({ message: 'Add headers?', initialValue: false }),
    );
    if (shouldAdd === BACK) return BACK;

    if (shouldAdd) {
      let addMore = true;
      while (addMore) {
        const key = handleCancel(
          await p.text({ message: 'Header name', placeholder: 'ex: Authorization' }),
        );
        if (key === BACK) break;

        const value = handleCancel(
          await p.text({ message: `Value for ${key}` }),
        );
        if (value === BACK) break;

        headers[key as string] = value as string;

        const more = handleCancel(
          await p.confirm({ message: 'Add another header?', initialValue: false }),
        );
        if (more === BACK) break;
        addMore = more as boolean;
      }
    }

    return { headers };
  };

  const result = await runSteps<ServerState>(
    [stepName, stepTransport, stepStdioCommand, stepStdioEnv, stepHttpUrl, stepHttpHeaders],
    {},
  );

  if (!result) return null;

  const config: McpServerConfig = { enabled: true, transport: result.transport };

  if (result.transport === 'stdio') {
    config.command = result.command;
    if (result.args?.length) config.args = result.args;
    if (result.env && Object.keys(result.env).length) config.env = result.env;
  } else {
    config.url = result.url;
    if (result.headers && Object.keys(result.headers).length) config.headers = result.headers;
  }
  return { name: result.name, config };
}
