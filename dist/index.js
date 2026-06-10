// src/core/config-store.ts
import os from "os";
import path2 from "path";

// src/utils/fs.ts
import fs from "fs";
import path from "path";
function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}
function writeJsonFile(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
function writeTextFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}
function readTextFile(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}
function fileExists(filePath) {
  return fs.existsSync(filePath);
}
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// src/types/canonical.ts
import { z } from "zod";
var PROVIDER_NAMES = [
  "claude-code",
  "antigravity-cli",
  "kimi-cli",
  "openai-codex",
  "opencode",
  "copilot-cli",
  "vscode",
  "intellij"
];
var McpServerConfigSchema = z.object({
  description: z.string().optional(),
  transport: z.enum(["stdio", "http"]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional()
});
var McpConfigFileSchema = z.object({
  version: z.literal(1),
  providers: z.array(z.enum(PROVIDER_NAMES)),
  servers: z.record(McpServerConfigSchema)
});

// src/utils/validation.ts
function validateConfig(data) {
  return McpConfigFileSchema.parse(data);
}

// src/core/config-store.ts
var GLOBAL_CONFIG_PATH = path2.join(os.homedir(), ".agents", "mcp.json");
var ConfigStore = class {
  configPath;
  constructor(_projectRoot) {
    this.configPath = GLOBAL_CONFIG_PATH;
  }
  exists() {
    return fileExists(this.configPath);
  }
  getPath() {
    return this.configPath;
  }
  load() {
    const raw = readJsonFile(this.configPath);
    return validateConfig(raw);
  }
  save(config) {
    writeJsonFile(this.configPath, normalizeConfig(config));
  }
  createEmpty(providers = []) {
    const config = {
      version: 1,
      providers,
      servers: {}
    };
    this.save(config);
    return config;
  }
  addServer(name, server) {
    const config = this.load();
    config.servers[name] = server;
    this.save(config);
    return config;
  }
  removeServer(name) {
    const config = this.load();
    delete config.servers[name];
    this.save(config);
    return config;
  }
  setProviders(providers) {
    const config = this.load();
    config.providers = providers;
    this.save(config);
    return config;
  }
  getServers() {
    return this.load().servers;
  }
  getProviders() {
    return this.load().providers;
  }
};
function normalizeConfig(config) {
  const sortedProviders = [...config.providers].sort();
  const sortedServers = Object.fromEntries(
    Object.entries(config.servers).sort(([a], [b]) => a.localeCompare(b))
  );
  return {
    ...config,
    providers: sortedProviders,
    servers: sortedServers
  };
}

// src/core/detector.ts
var ConfigDetector = class {
  constructor(projectRoot, registry) {
    this.projectRoot = projectRoot;
    this.registry = registry;
  }
  detectAll() {
    const results = [];
    for (const provider of this.registry.getAll()) {
      if (!provider.config.supportsProjectConfig) continue;
      if (!provider.exists(this.projectRoot)) continue;
      try {
        const content = readTextFile(provider.getConfigFilePath(this.projectRoot));
        const servers = provider.parse(content);
        results.push({
          provider: provider.config.name,
          filePath: provider.getConfigFilePath(this.projectRoot),
          servers: Object.keys(servers)
        });
      } catch {
      }
    }
    return results;
  }
};

// src/core/merger.ts
import nodePath from "path";
function syncProvider(provider, projectRoot, servers) {
  const filePath = provider.getConfigFilePath(projectRoot);
  const newContent = provider.generate(servers);
  try {
    if (fileExists(filePath)) {
      const currentContent = readTextFile(filePath);
      const mergedContent = provider.generate(servers, currentContent);
      if (currentContent === mergedContent) {
        return { provider: provider.config.name, filePath, status: "unchanged" };
      }
      writeTextFile(filePath, mergedContent);
      return { provider: provider.config.name, filePath, status: "updated" };
    }
    writeTextFile(filePath, newContent);
    return { provider: provider.config.name, filePath, status: "created" };
  } catch (err) {
    return {
      provider: provider.config.name,
      filePath,
      status: "error",
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
function syncAllProviders(providers, projectRoot, servers) {
  return providers.map((provider) => syncProvider(provider, projectRoot, servers));
}

// src/providers/claude-code.ts
import path3 from "path";

// src/utils/json-like.ts
function parseJsonLike(content) {
  try {
    return JSON.parse(content);
  } catch {
    return JSON.parse(stripTrailingCommas(stripJsonComments(content)));
  }
}
function updateJsonLikeTopLevelSection(content, key, value) {
  const jsonValue = JSON.stringify(value, null, 2);
  const rootStart = findRootObjectStart(content);
  const rootEnd = findMatchingBracket(content, rootStart, "{", "}");
  const existingSection = findTopLevelProperty(content, rootStart, rootEnd, key);
  if (existingSection) {
    const propertyIndent2 = getLineIndent(content, existingSection.propertyStart);
    const replacementValue = indentMultiline(jsonValue, propertyIndent2);
    return content.slice(0, existingSection.valueStart) + replacementValue + content.slice(existingSection.valueEnd);
  }
  const propertyIndent = detectPropertyIndent(content, rootStart, rootEnd);
  const property = `${propertyIndent}${JSON.stringify(key)}: ${indentMultiline(jsonValue, propertyIndent)}`;
  const closingIndent = getLineIndent(content, rootEnd);
  const hasProperties = objectHasProperties(content, rootStart, rootEnd);
  const insertion = hasProperties ? `,
${property}
${closingIndent}` : `
${property}
${closingIndent}`;
  return content.slice(0, rootEnd) + insertion + content.slice(rootEnd);
}
function stripJsonComments(content) {
  let result = "";
  let inString = false;
  let stringDelimiter = "";
  for (let i = 0; i < content.length; i++) {
    const current = content[i];
    const next = content[i + 1];
    const previous = content[i - 1];
    if (inString) {
      result += current;
      if (current === stringDelimiter && !isEscaped(content, i)) {
        inString = false;
        stringDelimiter = "";
      }
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringDelimiter = current;
      result += current;
      continue;
    }
    if (current === "/" && next === "/") {
      i += 2;
      while (i < content.length && content[i] !== "\n") {
        i++;
      }
      if (i < content.length) {
        result += "\n";
      }
      continue;
    }
    if (current === "/" && next === "*") {
      i += 2;
      while (i < content.length - 1) {
        if (content[i] === "*" && content[i + 1] === "/") {
          i++;
          break;
        }
        if (content[i] === "\n") {
          result += "\n";
        }
        i++;
      }
      continue;
    }
    result += current;
  }
  return result;
}
function stripTrailingCommas(content) {
  let result = "";
  let inString = false;
  let stringDelimiter = "";
  for (let i = 0; i < content.length; i++) {
    const current = content[i];
    if (inString) {
      result += current;
      if (current === stringDelimiter && !isEscaped(content, i)) {
        inString = false;
        stringDelimiter = "";
      }
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringDelimiter = current;
      result += current;
      continue;
    }
    if (current === ",") {
      let j = skipWhitespaceAndComments(content, i + 1);
      if (content[j] === "}" || content[j] === "]") {
        continue;
      }
    }
    result += current;
  }
  return result;
}
function findRootObjectStart(content) {
  const start = skipWhitespaceAndComments(content, 0);
  if (content[start] !== "{") {
    throw new Error("Expected a JSON object at the root of the file.");
  }
  return start;
}
function objectHasProperties(content, rootStart, rootEnd) {
  return skipWhitespaceAndComments(content, rootStart + 1) < rootEnd;
}
function detectPropertyIndent(content, rootStart, rootEnd) {
  const firstToken = skipWhitespaceAndComments(content, rootStart + 1);
  if (firstToken < rootEnd && content[firstToken] === '"') {
    return getLineIndent(content, firstToken);
  }
  return "  ";
}
function findTopLevelProperty(content, rootStart, rootEnd, key) {
  let index = skipWhitespaceAndComments(content, rootStart + 1);
  while (index < rootEnd) {
    if (content[index] === "}") {
      break;
    }
    const propertyStart = index;
    if (content[index] !== '"') {
      throw new Error("Expected a quoted property name in JSON object.");
    }
    const keyEnd = scanString(content, index);
    const parsedKey = JSON.parse(content.slice(index, keyEnd));
    index = skipWhitespaceAndComments(content, keyEnd);
    if (content[index] !== ":") {
      throw new Error("Expected a colon after a JSON property name.");
    }
    const valueStart = skipWhitespaceAndComments(content, index + 1);
    const valueEnd = scanValue(content, valueStart);
    if (parsedKey === key) {
      return { propertyStart, valueStart, valueEnd };
    }
    index = skipWhitespaceAndComments(content, valueEnd);
    if (content[index] === ",") {
      index = skipWhitespaceAndComments(content, index + 1);
      continue;
    }
    if (content[index] === "}") {
      break;
    }
  }
  return null;
}
function scanValue(content, index) {
  const current = content[index];
  if (current === '"') {
    return scanString(content, index);
  }
  if (current === "{") {
    return findMatchingBracket(content, index, "{", "}") + 1;
  }
  if (current === "[") {
    return findMatchingBracket(content, index, "[", "]") + 1;
  }
  let cursor = index;
  while (cursor < content.length) {
    const char = content[cursor];
    if (char === "," || char === "}" || char === "]") {
      return cursor;
    }
    cursor++;
  }
  return cursor;
}
function scanString(content, index) {
  const delimiter = content[index];
  let cursor = index + 1;
  while (cursor < content.length) {
    if (content[cursor] === delimiter && !isEscaped(content, cursor)) {
      return cursor + 1;
    }
    cursor++;
  }
  throw new Error("Unterminated string literal.");
}
function findMatchingBracket(content, index, open, close) {
  let depth = 0;
  let inString = false;
  let stringDelimiter = "";
  for (let cursor = index; cursor < content.length; cursor++) {
    const current = content[cursor];
    const next = content[cursor + 1];
    if (inString) {
      if (current === stringDelimiter && !isEscaped(content, cursor)) {
        inString = false;
        stringDelimiter = "";
      }
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringDelimiter = current;
      continue;
    }
    if (current === "/" && next === "/") {
      cursor += 2;
      while (cursor < content.length && content[cursor] !== "\n") {
        cursor++;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      cursor += 2;
      while (cursor < content.length - 1) {
        if (content[cursor] === "*" && content[cursor + 1] === "/") {
          cursor++;
          break;
        }
        cursor++;
      }
      continue;
    }
    if (current === open) {
      depth++;
      continue;
    }
    if (current === close) {
      depth--;
      if (depth === 0) {
        return cursor;
      }
    }
  }
  throw new Error(`Unterminated ${open}${close} block.`);
}
function skipWhitespaceAndComments(content, index) {
  let cursor = index;
  while (cursor < content.length) {
    const current = content[cursor];
    const next = content[cursor + 1];
    if (/\s/.test(current)) {
      cursor++;
      continue;
    }
    if (current === "/" && next === "/") {
      cursor += 2;
      while (cursor < content.length && content[cursor] !== "\n") {
        cursor++;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      cursor += 2;
      while (cursor < content.length - 1) {
        if (content[cursor] === "*" && content[cursor + 1] === "/") {
          cursor += 2;
          break;
        }
        cursor++;
      }
      continue;
    }
    break;
  }
  return cursor;
}
function getLineIndent(content, index) {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  let cursor = lineStart;
  while (cursor < index && (content[cursor] === " " || content[cursor] === "	")) {
    cursor++;
  }
  return content.slice(lineStart, cursor);
}
function indentMultiline(content, indent) {
  const lines = content.split("\n");
  if (lines.length <= 1) {
    return content;
  }
  return lines[0] + lines.slice(1).map((line) => `
${indent}${line}`).join("");
}
function isEscaped(content, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

// src/providers/claude-code.ts
var ClaudeCodeProvider = class {
  config = {
    name: "claude-code",
    displayName: "Claude Code",
    configPath: ".mcp.json",
    supportsProjectConfig: true
  };
  generate(servers, existingContent) {
    const mcpServers = {};
    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;
      if (server.transport === "stdio") {
        mcpServers[name] = {
          type: "stdio",
          command: server.command,
          ...server.args?.length && { args: server.args },
          ...server.env && Object.keys(server.env).length && { env: server.env }
        };
      } else if (server.transport === "http") {
        mcpServers[name] = {
          type: "http",
          url: server.url,
          ...server.headers && Object.keys(server.headers).length && { headers: server.headers }
        };
      }
    }
    if (existingContent) {
      try {
        return updateJsonLikeTopLevelSection(existingContent, "mcpServers", mcpServers);
      } catch {
      }
    }
    return JSON.stringify({ mcpServers }, null, 2) + "\n";
  }
  parse(content) {
    const data = parseJsonLike(content);
    const servers = {};
    for (const [name, raw] of Object.entries(data.mcpServers ?? {})) {
      const server = {
        transport: raw["type"] === "http" ? "http" : "stdio"
      };
      if (raw["command"]) server.command = raw["command"];
      if (raw["args"]) server.args = raw["args"];
      if (raw["env"]) server.env = raw["env"];
      if (raw["url"]) server.url = raw["url"];
      if (raw["headers"]) server.headers = raw["headers"];
      servers[name] = server;
    }
    return servers;
  }
  getConfigFilePath(projectRoot) {
    return path3.join(projectRoot, this.config.configPath);
  }
  exists(projectRoot) {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
};

// src/providers/antigravity-cli.ts
import os2 from "os";
import path4 from "path";
var AntigravityCliProvider = class {
  config = {
    name: "antigravity-cli",
    displayName: "Antigravity CLI",
    configPath: ".gemini/config/mcp_config.json",
    supportsProjectConfig: false,
    globalConfigPath: path4.join(os2.homedir(), ".gemini", "config", "mcp_config.json")
  };
  generate(servers, existingContent) {
    const mcpServers = {};
    for (const [name, server] of Object.entries(servers)) {
      if (server.transport === "stdio") {
        mcpServers[name] = {
          command: server.command,
          ...server.args?.length && { args: server.args },
          ...server.env && Object.keys(server.env).length && { env: server.env },
          ...server.enabled === false && { disabled: true }
        };
      } else if (server.transport === "http") {
        mcpServers[name] = {
          serverUrl: server.url,
          ...server.headers && Object.keys(server.headers).length && { headers: server.headers },
          ...server.enabled === false && { disabled: true }
        };
      }
    }
    if (existingContent) {
      try {
        return updateJsonLikeTopLevelSection(existingContent, "mcpServers", mcpServers);
      } catch {
      }
    }
    return JSON.stringify({ mcpServers }, null, 2) + "\n";
  }
  parse(content) {
    const data = parseJsonLike(content);
    const servers = {};
    for (const [name, raw] of Object.entries(data.mcpServers ?? {})) {
      const server = {
        transport: raw["serverUrl"] ? "http" : "stdio"
      };
      if (raw["command"]) server.command = raw["command"];
      if (raw["args"]) server.args = raw["args"];
      if (raw["env"]) server.env = raw["env"];
      if (raw["serverUrl"]) server.url = raw["serverUrl"];
      if (raw["headers"]) server.headers = raw["headers"];
      servers[name] = server;
    }
    return servers;
  }
  getConfigFilePath(projectRoot) {
    if (this.config.globalConfigPath) {
      return this.config.globalConfigPath;
    }
    return path4.join(projectRoot, this.config.configPath);
  }
  exists(projectRoot) {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
};

// src/providers/kimi-cli.ts
import os3 from "os";
import path5 from "path";
var KimiCliProvider = class {
  config = {
    name: "kimi-cli",
    displayName: "Kimi CLI",
    configPath: ".kimi/mcp.json",
    supportsProjectConfig: false,
    globalConfigPath: path5.join(os3.homedir(), ".kimi", "mcp.json")
  };
  generate(servers, existingContent) {
    const mcpServers = {};
    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;
      if (server.transport === "stdio") {
        mcpServers[name] = {
          command: server.command,
          ...server.args?.length && { args: server.args },
          ...server.env && Object.keys(server.env).length && { env: server.env }
        };
      } else if (server.transport === "http") {
        mcpServers[name] = {
          url: server.url,
          ...server.headers && Object.keys(server.headers).length && { headers: server.headers }
        };
      }
    }
    if (existingContent) {
      try {
        return updateJsonLikeTopLevelSection(existingContent, "mcpServers", mcpServers);
      } catch {
      }
    }
    return JSON.stringify({ mcpServers }, null, 2) + "\n";
  }
  parse(content) {
    const data = parseJsonLike(content);
    const servers = {};
    for (const [name, raw] of Object.entries(data.mcpServers ?? {})) {
      const server = {
        transport: raw["url"] ? "http" : "stdio"
      };
      if (raw["command"]) server.command = raw["command"];
      if (raw["args"]) server.args = raw["args"];
      if (raw["env"]) server.env = raw["env"];
      if (raw["url"]) server.url = raw["url"];
      if (raw["headers"]) server.headers = raw["headers"];
      servers[name] = server;
    }
    return servers;
  }
  getConfigFilePath(projectRoot) {
    if (this.config.globalConfigPath) {
      return this.config.globalConfigPath;
    }
    return path5.join(projectRoot, this.config.configPath);
  }
  exists(projectRoot) {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
};

// src/providers/openai-codex.ts
import path6 from "path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
var OpenAICodexProvider = class {
  config = {
    name: "openai-codex",
    displayName: "OpenAI Codex",
    configPath: ".codex/config.toml",
    supportsProjectConfig: true
  };
  generate(servers, existingContent) {
    const mcpServers = {};
    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;
      if (server.transport === "stdio") {
        mcpServers[name] = {
          command: server.command ?? "",
          ...server.args?.length && { args: server.args },
          ...server.env && Object.keys(server.env).length && { env: server.env },
          ...server.cwd && { cwd: server.cwd }
        };
      } else if (server.transport === "http") {
        mcpServers[name] = {
          ...server.url && { url: server.url },
          ...server.headers && Object.keys(server.headers).length && { http_headers: server.headers }
        };
      }
    }
    if (existingContent) {
      try {
        const existing = parseToml(existingContent);
        existing["mcp_servers"] = mcpServers;
        return stringifyToml(existing) + "\n";
      } catch {
      }
    }
    return stringifyToml({ mcp_servers: mcpServers }) + "\n";
  }
  parse(content) {
    const data = parseToml(content);
    const servers = {};
    for (const [name, raw] of Object.entries(data.mcp_servers ?? {})) {
      const server = {
        transport: raw["url"] ? "http" : "stdio"
      };
      if (raw["command"]) server.command = raw["command"];
      if (raw["args"]) server.args = raw["args"];
      if (raw["env"]) server.env = raw["env"];
      if (raw["url"]) server.url = raw["url"];
      if (raw["http_headers"]) server.headers = raw["http_headers"];
      if (raw["cwd"]) server.cwd = raw["cwd"];
      servers[name] = server;
    }
    return servers;
  }
  getConfigFilePath(projectRoot) {
    return path6.join(projectRoot, this.config.configPath);
  }
  exists(projectRoot) {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
};

// src/providers/opencode.ts
import os4 from "os";
import path7 from "path";
var OPEN_CODE_DIR = path7.join(os4.homedir(), ".config", "opencode");
var OPEN_CODE_JSONC_PATH = path7.join(OPEN_CODE_DIR, "opencode.jsonc");
var OPEN_CODE_JSON_PATH = path7.join(OPEN_CODE_DIR, "opencode.json");
var OpenCodeProvider = class {
  config = {
    name: "opencode",
    displayName: "OpenCode",
    configPath: "opencode.json",
    supportsProjectConfig: false,
    globalConfigPath: OPEN_CODE_JSONC_PATH
  };
  generate(servers) {
    const mcp = {};
    for (const [name, server] of Object.entries(servers)) {
      if (server.transport === "stdio") {
        const command = [server.command, ...server.args ?? []];
        mcp[name] = {
          enabled: server.enabled !== false,
          type: "local",
          command,
          ...server.env && Object.keys(server.env).length && { environment: server.env }
        };
      } else if (server.transport === "http") {
        mcp[name] = {
          enabled: server.enabled !== false,
          type: "remote",
          url: server.url,
          ...server.headers && Object.keys(server.headers).length && { headers: server.headers }
        };
      }
    }
    return JSON.stringify({ $schema: "https://opencode.ai/config.json", mcp }, null, 2) + "\n";
  }
  parse(content) {
    const data = parseJsonLike(content);
    const servers = {};
    for (const [name, raw] of Object.entries(data.mcp ?? {})) {
      const commandArray = raw["command"];
      const cmd = commandArray?.[0];
      const args = commandArray?.slice(1);
      const server = {
        transport: raw["type"] === "remote" ? "http" : "stdio"
      };
      if (cmd) server.command = cmd;
      if (args?.length) server.args = args;
      if (raw["environment"]) server.env = raw["environment"];
      if (raw["url"]) server.url = raw["url"];
      if (raw["headers"]) server.headers = raw["headers"];
      servers[name] = server;
    }
    return servers;
  }
  getConfigFilePath(_projectRoot) {
    if (fileExists(OPEN_CODE_JSONC_PATH)) {
      return OPEN_CODE_JSONC_PATH;
    }
    if (fileExists(OPEN_CODE_JSON_PATH)) {
      return OPEN_CODE_JSON_PATH;
    }
    return OPEN_CODE_JSONC_PATH;
  }
  exists(projectRoot) {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
};

// src/providers/copilot-cli.ts
import os5 from "os";
import path8 from "path";
var CopilotCliProvider = class {
  config = {
    name: "copilot-cli",
    displayName: "Copilot CLI",
    configPath: ".copilot/mcp-config.json",
    supportsProjectConfig: false,
    globalConfigPath: path8.join(os5.homedir(), ".copilot", "mcp-config.json")
  };
  generate(servers, existingContent) {
    const mcpServers = {};
    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;
      if (server.transport === "stdio") {
        mcpServers[name] = {
          command: server.command,
          ...server.args?.length && { args: server.args },
          ...server.env && Object.keys(server.env).length && { env: server.env },
          ...server.cwd && { cwd: server.cwd }
        };
      } else if (server.transport === "http") {
        mcpServers[name] = {
          type: "http",
          url: server.url,
          ...server.headers && Object.keys(server.headers).length && { headers: server.headers }
        };
      }
    }
    if (existingContent) {
      try {
        return updateJsonLikeTopLevelSection(existingContent, "mcpServers", mcpServers);
      } catch {
      }
    }
    return JSON.stringify({ mcpServers }, null, 2) + "\n";
  }
  parse(content) {
    const data = parseJsonLike(content);
    const servers = {};
    for (const [name, raw] of Object.entries(data.mcpServers ?? {})) {
      const server = {
        transport: raw["type"] === "http" ? "http" : "stdio"
      };
      if (raw["command"]) server.command = raw["command"];
      if (raw["args"]) server.args = raw["args"];
      if (raw["env"]) server.env = raw["env"];
      if (raw["url"]) server.url = raw["url"];
      if (raw["headers"]) server.headers = raw["headers"];
      servers[name] = server;
    }
    return servers;
  }
  getConfigFilePath(projectRoot) {
    if (this.config.globalConfigPath) {
      return this.config.globalConfigPath;
    }
    return path8.join(projectRoot, this.config.configPath);
  }
  exists(projectRoot) {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
};

// src/providers/vscode.ts
import path9 from "path";
var VscodeProvider = class {
  config = {
    name: "vscode",
    displayName: "VS Code",
    configPath: ".vscode/mcp.json",
    supportsProjectConfig: true
  };
  generate(servers, existingContent) {
    const vscodeServers = {};
    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;
      if (server.transport === "stdio") {
        vscodeServers[name] = {
          type: "stdio",
          command: server.command,
          ...server.args?.length && { args: server.args },
          ...server.env && Object.keys(server.env).length && { env: server.env }
        };
      } else if (server.transport === "http") {
        vscodeServers[name] = {
          type: "sse",
          url: server.url,
          ...server.headers && Object.keys(server.headers).length && { headers: server.headers }
        };
      }
    }
    if (existingContent) {
      try {
        return updateJsonLikeTopLevelSection(existingContent, "servers", vscodeServers);
      } catch {
      }
    }
    return JSON.stringify({ servers: vscodeServers }, null, 2) + "\n";
  }
  parse(content) {
    const data = parseJsonLike(content);
    const servers = {};
    for (const [name, raw] of Object.entries(data.servers ?? {})) {
      const server = {
        transport: raw["type"] === "sse" ? "http" : "stdio"
      };
      if (raw["command"]) server.command = raw["command"];
      if (raw["args"]) server.args = raw["args"];
      if (raw["env"]) server.env = raw["env"];
      if (raw["url"]) server.url = raw["url"];
      if (raw["headers"]) server.headers = raw["headers"];
      servers[name] = server;
    }
    return servers;
  }
  getConfigFilePath(projectRoot) {
    return path9.join(projectRoot, this.config.configPath);
  }
  exists(projectRoot) {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
};

// src/providers/intellij.ts
import path10 from "path";
var IntellijProvider = class {
  config = {
    name: "intellij",
    displayName: "IntelliJ IDEA",
    configPath: ".idea/mcp.json",
    supportsProjectConfig: true
  };
  generate(servers, existingContent) {
    const mcpServers = {};
    for (const [name, server] of Object.entries(servers)) {
      if (server.enabled === false) continue;
      if (server.transport === "stdio") {
        mcpServers[name] = {
          command: server.command,
          ...server.args?.length && { args: server.args },
          ...server.env && Object.keys(server.env).length && { env: server.env }
        };
      } else if (server.transport === "http") {
        mcpServers[name] = {
          url: server.url,
          ...server.headers && Object.keys(server.headers).length && { headers: server.headers }
        };
      }
    }
    if (existingContent) {
      try {
        return updateJsonLikeTopLevelSection(existingContent, "mcpServers", mcpServers);
      } catch {
      }
    }
    return JSON.stringify({ mcpServers }, null, 2) + "\n";
  }
  parse(content) {
    const data = parseJsonLike(content);
    const servers = {};
    for (const [name, raw] of Object.entries(data.mcpServers ?? {})) {
      const server = {
        transport: raw["url"] ? "http" : "stdio"
      };
      if (raw["command"]) server.command = raw["command"];
      if (raw["args"]) server.args = raw["args"];
      if (raw["env"]) server.env = raw["env"];
      if (raw["url"]) server.url = raw["url"];
      if (raw["headers"]) server.headers = raw["headers"];
      servers[name] = server;
    }
    return servers;
  }
  getConfigFilePath(projectRoot) {
    return path10.join(projectRoot, this.config.configPath);
  }
  exists(projectRoot) {
    return fileExists(this.getConfigFilePath(projectRoot));
  }
};

// src/providers/registry.ts
var ProviderRegistry = class {
  providers = /* @__PURE__ */ new Map();
  register(provider) {
    this.providers.set(provider.config.name, provider);
  }
  get(name) {
    return this.providers.get(name);
  }
  getAll() {
    return Array.from(this.providers.values());
  }
  getByNames(names) {
    return names.map((n) => this.providers.get(n)).filter((p) => p !== void 0);
  }
};
function createRegistry() {
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
export {
  AntigravityCliProvider,
  ClaudeCodeProvider,
  ConfigDetector,
  ConfigStore,
  CopilotCliProvider,
  KimiCliProvider,
  OpenAICodexProvider,
  OpenCodeProvider,
  ProviderRegistry,
  createRegistry,
  syncAllProviders,
  syncProvider
};
