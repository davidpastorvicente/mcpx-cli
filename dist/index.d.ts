import { z } from 'zod';

declare const PROVIDER_NAMES: readonly ["claude-code", "antigravity-cli", "kimi-cli", "openai-codex", "opencode", "copilot-cli", "vscode", "intellij"];
type ProviderName = (typeof PROVIDER_NAMES)[number];
declare const McpServerConfigSchema: z.ZodObject<{
    description: z.ZodOptional<z.ZodString>;
    transport: z.ZodEnum<["stdio", "http"]>;
    command: z.ZodOptional<z.ZodString>;
    args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    cwd: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    transport: "stdio" | "http";
    description?: string | undefined;
    command?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    cwd?: string | undefined;
    url?: string | undefined;
    headers?: Record<string, string> | undefined;
    enabled?: boolean | undefined;
}, {
    transport: "stdio" | "http";
    description?: string | undefined;
    command?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    cwd?: string | undefined;
    url?: string | undefined;
    headers?: Record<string, string> | undefined;
    enabled?: boolean | undefined;
}>;
type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
declare const McpConfigFileSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    providers: z.ZodArray<z.ZodEnum<["claude-code", "antigravity-cli", "kimi-cli", "openai-codex", "opencode", "copilot-cli", "vscode", "intellij"]>, "many">;
    servers: z.ZodRecord<z.ZodString, z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
        transport: z.ZodEnum<["stdio", "http"]>;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        cwd: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        transport: "stdio" | "http";
        description?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        cwd?: string | undefined;
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
    }, {
        transport: "stdio" | "http";
        description?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        cwd?: string | undefined;
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    version: 1;
    providers: ("claude-code" | "antigravity-cli" | "kimi-cli" | "openai-codex" | "opencode" | "copilot-cli" | "vscode" | "intellij")[];
    servers: Record<string, {
        transport: "stdio" | "http";
        description?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        cwd?: string | undefined;
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
    }>;
}, {
    version: 1;
    providers: ("claude-code" | "antigravity-cli" | "kimi-cli" | "openai-codex" | "opencode" | "copilot-cli" | "vscode" | "intellij")[];
    servers: Record<string, {
        transport: "stdio" | "http";
        description?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        cwd?: string | undefined;
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        enabled?: boolean | undefined;
    }>;
}>;
type McpConfigFile = z.infer<typeof McpConfigFileSchema>;

declare class ConfigStore {
    private configPath;
    constructor(_projectRoot: string);
    exists(): boolean;
    getPath(): string;
    load(): McpConfigFile;
    save(config: McpConfigFile): void;
    createEmpty(providers?: ProviderName[]): McpConfigFile;
    addServer(name: string, server: McpServerConfig): McpConfigFile;
    removeServer(name: string): McpConfigFile;
    setProviders(providers: ProviderName[]): McpConfigFile;
    getServers(): Record<string, McpServerConfig>;
    getProviders(): ProviderName[];
}

interface CommandContext {
    projectRoot: string;
    verbose: boolean;
}
interface SyncResult {
    provider: ProviderName;
    filePath: string;
    status: 'created' | 'updated' | 'unchanged' | 'deleted' | 'error';
    error?: string;
}
interface ImportResult {
    provider: ProviderName;
    serversFound: number;
    serversImported: string[];
}
interface DetectionResult {
    provider: ProviderName;
    filePath: string;
    servers: string[];
}

interface ProviderConfig {
    name: ProviderName;
    displayName: string;
    configPath: string;
    supportsProjectConfig: boolean;
    globalConfigPath?: string;
}
interface Provider {
    readonly config: ProviderConfig;
    generate(servers: Record<string, McpServerConfig>, existingContent?: string): string;
    parse(content: string): Record<string, McpServerConfig>;
    getConfigFilePath(projectRoot: string): string;
    exists(projectRoot: string): boolean;
}

declare class ProviderRegistry {
    private providers;
    register(provider: Provider): void;
    get(name: ProviderName): Provider | undefined;
    getAll(): Provider[];
    getByNames(names: ProviderName[]): Provider[];
}
declare function createRegistry(): ProviderRegistry;

declare class ConfigDetector {
    private projectRoot;
    private registry;
    constructor(projectRoot: string, registry: ProviderRegistry);
    detectAll(): DetectionResult[];
}

declare function syncProvider(provider: Provider, projectRoot: string, servers: Record<string, McpServerConfig>): SyncResult;
declare function syncAllProviders(providers: Provider[], projectRoot: string, servers: Record<string, McpServerConfig>): SyncResult[];

declare class ClaudeCodeProvider implements Provider {
    readonly config: ProviderConfig;
    generate(servers: Record<string, McpServerConfig>, existingContent?: string): string;
    parse(content: string): Record<string, McpServerConfig>;
    getConfigFilePath(projectRoot: string): string;
    exists(projectRoot: string): boolean;
}

declare class AntigravityCliProvider implements Provider {
    readonly config: ProviderConfig;
    generate(servers: Record<string, McpServerConfig>, existingContent?: string): string;
    parse(content: string): Record<string, McpServerConfig>;
    getConfigFilePath(projectRoot: string): string;
    exists(projectRoot: string): boolean;
}

declare class KimiCliProvider implements Provider {
    readonly config: ProviderConfig;
    generate(servers: Record<string, McpServerConfig>, existingContent?: string): string;
    parse(content: string): Record<string, McpServerConfig>;
    getConfigFilePath(projectRoot: string): string;
    exists(projectRoot: string): boolean;
}

declare class OpenAICodexProvider implements Provider {
    readonly config: ProviderConfig;
    generate(servers: Record<string, McpServerConfig>, existingContent?: string): string;
    parse(content: string): Record<string, McpServerConfig>;
    getConfigFilePath(projectRoot: string): string;
    exists(projectRoot: string): boolean;
}

declare class OpenCodeProvider implements Provider {
    readonly config: ProviderConfig;
    generate(servers: Record<string, McpServerConfig>): string;
    parse(content: string): Record<string, McpServerConfig>;
    getConfigFilePath(_projectRoot: string): string;
    exists(projectRoot: string): boolean;
}

declare class CopilotCliProvider implements Provider {
    readonly config: ProviderConfig;
    generate(servers: Record<string, McpServerConfig>, existingContent?: string): string;
    parse(content: string): Record<string, McpServerConfig>;
    getConfigFilePath(projectRoot: string): string;
    exists(projectRoot: string): boolean;
}

export { AntigravityCliProvider, ClaudeCodeProvider, type CommandContext, ConfigDetector, ConfigStore, CopilotCliProvider, type DetectionResult, type ImportResult, KimiCliProvider, type McpConfigFile, type McpServerConfig, OpenAICodexProvider, OpenCodeProvider, type Provider, type ProviderConfig, type ProviderName, ProviderRegistry, type SyncResult, createRegistry, syncAllProviders, syncProvider };
