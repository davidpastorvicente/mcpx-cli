import { z } from 'zod';

export const PROVIDER_NAMES = [
  'claude-code',
  'antigravity-cli',
  'kimi-cli',
  'openai-codex',
  'opencode',
  'copilot-cli',
  'vscode',
  'intellij',
] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const McpServerConfigSchema = z.object({
  description: z.string().optional(),
  transport: z.enum(['stdio', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const McpConfigFileSchema = z.object({
  version: z.literal(1),
  providers: z.array(z.enum(PROVIDER_NAMES)),
  servers: z.record(McpServerConfigSchema),
});

export type McpConfigFile = z.infer<typeof McpConfigFileSchema>;
