#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";

// package.json
var package_default = {
  name: "mcpx-cli",
  version: "0.7.0",
  description: "Interactive CLI for configuring MCP servers across multiple AI providers",
  type: "module",
  bin: {
    mcpx: "./dist/bin/mcpx.js"
  },
  author: "gustavodiasdev",
  repository: {
    type: "git",
    url: "git+https://github.com/gustavodiasdev/mcpx-cli.git"
  },
  homepage: "https://github.com/gustavodiasdev/mcpx-cli#readme",
  bugs: {
    url: "https://github.com/gustavodiasdev/mcpx-cli/issues"
  },
  main: "./dist/index.js",
  module: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: {
    ".": {
      import: "./dist/index.js",
      types: "./dist/index.d.ts"
    }
  },
  files: [
    "dist"
  ],
  scripts: {
    build: "tsup",
    dev: "tsup --watch",
    test: "vitest",
    "test:run": "vitest run",
    lint: "eslint src/",
    typecheck: "tsc --noEmit",
    prepare: "npm run build",
    prepublishOnly: "npm run build"
  },
  keywords: [
    "mcp",
    "model-context-protocol",
    "cli",
    "claude",
    "gemini",
    "codex",
    "opencode",
    "copilot",
    "vscode",
    "intellij",
    "jetbrains",
    "ai",
    "configuration"
  ],
  engines: {
    node: ">=20.0.0"
  },
  license: "MIT",
  dependencies: {
    "@clack/prompts": "^1.0.0",
    commander: "^13.0.0",
    picocolors: "^1.1.0",
    "smol-toml": "^1.3.0",
    zod: "^3.24.0"
  },
  devDependencies: {
    "@eslint/js": "^9.28.0",
    "@types/node": "^22.0.0",
    eslint: "^9.28.0",
    globals: "^16.2.0",
    tsup: "^8.0.0",
    "typescript-eslint": "^8.33.1",
    typescript: "^5.7.0",
    vitest: "^3.0.0"
  }
};

// src/wizard/main-wizard.ts
import * as p3 from "@clack/prompts";

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
function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
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
function isValidServerName(name) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name);
}

// src/core/config-store.ts
var GLOBAL_CONFIG_PATH = path2.join(os.homedir(), ".agents", "mcp.json");
var GLOBAL_CONFIG_DISPLAY_PATH = "~/.agents/mcp.json";
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
    return names.map((n) => this.providers.get(n)).filter((p10) => p10 !== void 0);
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
function cleanupRemovedProviders(removedProviders, projectRoot) {
  const results = [];
  for (const provider of removedProviders) {
    const filePath = provider.getConfigFilePath(projectRoot);
    try {
      if (deleteFile(filePath)) {
        results.push({ provider: provider.config.name, filePath, status: "deleted" });
      }
    } catch (err) {
      results.push({
        provider: provider.config.name,
        filePath,
        status: "error",
        error: err instanceof Error ? err.message : String(err)
      });
    }
    if (!provider.config.supportsProjectConfig && provider.config.globalConfigPath) {
      const projectFilePath = nodePath.join(projectRoot, provider.config.configPath);
      try {
        if (deleteFile(projectFilePath)) {
          results.push({ provider: provider.config.name, filePath: projectFilePath, status: "deleted" });
        }
      } catch {
      }
    }
  }
  return results;
}

// src/wizard/server-wizard.ts
import * as p from "@clack/prompts";

// src/wizard/step-runner.ts
import { isCancel } from "@clack/prompts";
var BACK = /* @__PURE__ */ Symbol("BACK");
function handleCancel(value) {
  if (isCancel(value)) return BACK;
  return value;
}
async function runSteps(steps, initialState = {}) {
  const stateHistory = [{ ...initialState }];
  let index = 0;
  while (index < steps.length) {
    const currentState = { ...stateHistory[index] };
    const result = await steps[index](currentState);
    if (result === BACK) {
      if (index === 0) return null;
      index--;
      continue;
    }
    if (result === null) return null;
    const merged = { ...currentState, ...result };
    stateHistory[index + 1] = merged;
    index++;
  }
  return stateHistory[index];
}

// src/wizard/server-wizard.ts
async function runServerWizard(existingNames = []) {
  const stepName = async () => {
    const result2 = handleCancel(
      await p.text({
        message: "MCP server name",
        placeholder: "ex: github, jira, my-server",
        validate: (v) => {
          const value = v?.trim() ?? "";
          if (!value) return "Name is required";
          if (!isValidServerName(value))
            return "Use letters, numbers, dots, hyphens, or underscores";
          if (existingNames.includes(value)) return `"${value}" already exists`;
        }
      })
    );
    if (result2 === BACK) return BACK;
    return { name: result2.trim() };
  };
  const stepTransport = async () => {
    const result2 = handleCancel(
      await p.select({
        message: "Transport type",
        options: [
          { value: "stdio", label: "stdio", hint: "local command" },
          { value: "http", label: "http", hint: "remote server" }
        ]
      })
    );
    if (result2 === BACK) return BACK;
    return { transport: result2 };
  };
  const stepStdioCommand = async (state) => {
    if (state.transport !== "stdio") return {};
    const cmd = handleCancel(
      await p.text({ message: "Command", placeholder: "ex: npx, uvx, docker" })
    );
    if (cmd === BACK) return BACK;
    const argsStr = handleCancel(
      await p.text({
        message: "Arguments",
        placeholder: "comma-separated, leave empty for none",
        initialValue: ""
      })
    );
    if (argsStr === BACK) return BACK;
    const args = argsStr.split(",").map((a) => a.trim()).filter(Boolean);
    return { command: cmd, args };
  };
  const stepStdioEnv = async (state) => {
    if (state.transport !== "stdio") return {};
    const env = {};
    const shouldAdd = handleCancel(
      await p.confirm({ message: "Add environment variables?", initialValue: false })
    );
    if (shouldAdd === BACK) return BACK;
    if (shouldAdd) {
      let addMore = true;
      while (addMore) {
        const key = handleCancel(
          await p.text({ message: "Variable name", placeholder: "ex: API_KEY" })
        );
        if (key === BACK) break;
        const value = handleCancel(
          await p.text({ message: `Value for ${key}` })
        );
        if (value === BACK) break;
        env[key] = value;
        const more = handleCancel(
          await p.confirm({ message: "Add another variable?", initialValue: false })
        );
        if (more === BACK) break;
        addMore = more;
      }
    }
    return { env };
  };
  const stepHttpUrl = async (state) => {
    if (state.transport !== "http") return {};
    const url = handleCancel(
      await p.text({ message: "Server URL", placeholder: "https://mcp.example.com/api" })
    );
    if (url === BACK) return BACK;
    return { url };
  };
  const stepHttpHeaders = async (state) => {
    if (state.transport !== "http") return {};
    const headers = {};
    const shouldAdd = handleCancel(
      await p.confirm({ message: "Add headers?", initialValue: false })
    );
    if (shouldAdd === BACK) return BACK;
    if (shouldAdd) {
      let addMore = true;
      while (addMore) {
        const key = handleCancel(
          await p.text({ message: "Header name", placeholder: "ex: Authorization" })
        );
        if (key === BACK) break;
        const value = handleCancel(
          await p.text({ message: `Value for ${key}` })
        );
        if (value === BACK) break;
        headers[key] = value;
        const more = handleCancel(
          await p.confirm({ message: "Add another header?", initialValue: false })
        );
        if (more === BACK) break;
        addMore = more;
      }
    }
    return { headers };
  };
  const stepDescription = async () => {
    const desc = handleCancel(
      await p.text({ message: "Description (optional)", initialValue: "", placeholder: "short server description" })
    );
    if (desc === BACK) return BACK;
    return { description: desc };
  };
  const result = await runSteps(
    [stepName, stepTransport, stepStdioCommand, stepStdioEnv, stepHttpUrl, stepHttpHeaders, stepDescription],
    {}
  );
  if (!result) return null;
  const config = { transport: result.transport };
  if (result.transport === "stdio") {
    config.command = result.command;
    if (result.args?.length) config.args = result.args;
    if (result.env && Object.keys(result.env).length) config.env = result.env;
  } else {
    config.url = result.url;
    if (result.headers && Object.keys(result.headers).length) config.headers = result.headers;
  }
  if (result.description) config.description = result.description;
  return { name: result.name, config };
}

// src/wizard/provider-wizard.ts
import * as p2 from "@clack/prompts";
var PROVIDER_DETAILS = {
  "claude-code": { path: ".mcp.json" },
  "antigravity-cli": { path: "~/.gemini/config/mcp_config.json", hint: "global, shared with Antigravity tools" },
  "kimi-cli": { path: "~/.kimi/mcp.json", hint: "global" },
  "openai-codex": { path: ".codex/config.toml" },
  "opencode": { path: "~/.config/opencode/opencode.jsonc", hint: "global, falls back to opencode.json" },
  "copilot-cli": { path: "~/.copilot/mcp-config.json", hint: "global" },
  "vscode": { path: ".vscode/mcp.json" },
  "intellij": { path: ".idea/mcp.json" }
};
async function runProviderWizard(preSelected = []) {
  const registry = createRegistry();
  const result = handleCancel(
    await p2.multiselect({
      message: "Select the providers to generate configuration for",
      options: PROVIDER_NAMES.map((name) => {
        const provider = registry.get(name);
        const details = PROVIDER_DETAILS[name];
        return {
          value: name,
          label: `${provider?.config.displayName ?? name}`,
          hint: `${details?.path}${details?.hint ? ` (${details.hint})` : ""}`
        };
      }),
      initialValues: preSelected
    })
  );
  if (result === BACK) return BACK;
  return result;
}

// src/wizard/main-wizard.ts
async function runMainWizard(projectRoot) {
  const store = new ConfigStore(projectRoot);
  const registry = createRegistry();
  p3.intro("MCPX - MCP server configuration");
  if (store.exists()) {
    await handleExistingConfig(store, registry, projectRoot);
    return;
  }
  await handleNewConfig(store, registry, projectRoot);
}
async function handleExistingConfig(store, registry, projectRoot) {
  const config = store.load();
  const serverCount = Object.keys(config.servers).length;
  p3.log.info(`Configuration found: ${serverCount} server(s), ${config.providers.length} provider(s)`);
  const action = handleCancel(
    await p3.select({
      message: "O que deseja fazer?",
      options: [
        { value: "add", label: "Add server" },
        { value: "remove", label: "Remove server" },
        { value: "providers", label: "Change providers" },
        { value: "sync", label: "Sync configs" },
        { value: "exit", label: "Exit" }
      ]
    })
  );
  if (action === BACK) {
    p3.outro("See you later!");
    return;
  }
  switch (action) {
    case "add": {
      const existingNames = Object.keys(config.servers);
      const result = await runServerWizard(existingNames);
      if (!result) {
        p3.cancel("Operation canceled.");
        break;
      }
      store.addServer(result.name, result.config);
      p3.log.success(`Server "${result.name}" added.`);
      const updatedConfig = store.load();
      const providers = registry.getByNames(updatedConfig.providers);
      const results = syncAllProviders(providers, projectRoot, updatedConfig.servers);
      printSyncResults(results);
      break;
    }
    case "remove": {
      const names = Object.keys(config.servers);
      if (names.length === 0) {
        p3.log.info("No servers to remove.");
        break;
      }
      const toRemove = handleCancel(
        await p3.select({
          message: "Which server should be removed?",
          options: names.map((n) => ({ value: n, label: n }))
        })
      );
      if (toRemove === BACK) break;
      const doConfirm = handleCancel(
        await p3.confirm({ message: `Confirm removal of "${toRemove}"?`, initialValue: false })
      );
      if (doConfirm === BACK || !doConfirm) break;
      store.removeServer(toRemove);
      p3.log.success(`Server "${toRemove}" removed.`);
      const updatedConfig = store.load();
      const providers = registry.getByNames(updatedConfig.providers);
      const results = syncAllProviders(providers, projectRoot, updatedConfig.servers);
      printSyncResults(results);
      break;
    }
    case "providers": {
      const newProviders = await runProviderWizard(config.providers);
      if (newProviders === BACK) break;
      const removedNames = config.providers.filter((p10) => !newProviders.includes(p10));
      const removedProviders = registry.getByNames(removedNames);
      store.setProviders(newProviders);
      p3.log.success("Providers updated.");
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
    case "sync": {
      const providers = registry.getByNames(config.providers);
      const results = syncAllProviders(providers, projectRoot, config.servers);
      printSyncResults(results);
      break;
    }
    case "exit":
      p3.outro("See you later!");
      break;
  }
}
async function handleNewConfig(store, registry, projectRoot) {
  const detector = new ConfigDetector(projectRoot, registry);
  const detections = detector.detectAll();
  let servers = {};
  if (detections.length > 0) {
    const lines = detections.map((det) => {
      const provider = registry.get(det.provider);
      return `${provider?.config.displayName ?? det.provider} - ${det.servers.length} server(s)`;
    });
    p3.note(lines.join("\n"), "Detected MCP configurations");
    const doImport = handleCancel(
      await p3.confirm({ message: "Import these configurations?", initialValue: true })
    );
    if (doImport === BACK) {
      p3.cancel("Operation canceled.");
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
        }
      }
      p3.log.success(`Imported ${Object.keys(servers).length} server(s).`);
    }
  }
  if (Object.keys(servers).length === 0) {
    p3.log.step("Let's configure your MCP servers.");
    let addMore = true;
    while (addMore) {
      const result = await runServerWizard(Object.keys(servers));
      if (!result) {
        if (Object.keys(servers).length === 0) {
          p3.cancel("Operation canceled.");
          return;
        }
        break;
      }
      servers[result.name] = result.config;
      p3.log.success(`Server "${result.name}" added.`);
      const more = handleCancel(
        await p3.confirm({ message: "Add another server?", initialValue: false })
      );
      if (more === BACK) break;
      addMore = more;
    }
  }
  const providers = await runProviderWizard();
  if (providers === BACK) {
    p3.cancel("Operation canceled.");
    return;
  }
  if (providers.length === 0) {
    p3.log.warn("No providers selected.");
  }
  const serverList = Object.keys(servers).join(", ");
  const providerList = providers.map((pn) => registry.get(pn)?.config.displayName ?? pn).join(", ") || "none";
  p3.note(`Servers: ${serverList}
Providers: ${providerList}`, "Summary");
  const doConfirm = handleCancel(
    await p3.confirm({ message: "Confirm and generate files?", initialValue: true })
  );
  if (doConfirm === BACK || !doConfirm) {
    p3.cancel("Operation canceled.");
    return;
  }
  store.save({ version: 1, providers, servers });
  p3.log.success(`Created: ${GLOBAL_CONFIG_DISPLAY_PATH}`);
  if (providers.length > 0) {
    const providerInstances = registry.getByNames(providers);
    const results = syncAllProviders(providerInstances, projectRoot, servers);
    printSyncResults(results);
  }
  p3.outro("Configuration complete!");
}
function printSyncResults(results) {
  for (const result of results) {
    switch (result.status) {
      case "created":
        p3.log.success(`Created: ${result.filePath}`);
        break;
      case "updated":
        p3.log.success(`Updated: ${result.filePath}`);
        break;
      case "deleted":
        p3.log.warn(`Removed: ${result.filePath}`);
        break;
      case "error":
        p3.log.error(`${result.filePath}: ${result.error}`);
        break;
    }
  }
}

// src/commands/init.ts
async function initCommand(ctx) {
  await runMainWizard(ctx.projectRoot);
}

// src/commands/add.ts
import * as p4 from "@clack/prompts";
async function addCommand(ctx, serverName) {
  const store = new ConfigStore(ctx.projectRoot);
  if (!store.exists()) {
    p4.log.warn(`No ${GLOBAL_CONFIG_DISPLAY_PATH} found in this directory.`);
    p4.log.info('Run "mcpx init" to create a configuration.');
    return;
  }
  const config = store.load();
  const existingNames = Object.keys(config.servers);
  if (serverName && config.servers[serverName]) {
    p4.log.warn(`Server "${serverName}" already exists. Use another name.`);
    return;
  }
  const result = await runServerWizard(existingNames);
  if (!result) {
    p4.cancel("Operation canceled.");
    return;
  }
  const updatedConfig = store.addServer(result.name, result.config);
  p4.log.success(`Server "${result.name}" added to ${GLOBAL_CONFIG_DISPLAY_PATH}`);
  const registry = createRegistry();
  const providers = registry.getByNames(updatedConfig.providers);
  const results = syncAllProviders(providers, ctx.projectRoot, updatedConfig.servers);
  for (const r of results) {
    if (r.status === "error") {
      p4.log.error(`${r.filePath}: ${r.error}`);
    } else if (r.status !== "unchanged") {
      p4.log.success(`Updated: ${r.filePath}`);
    }
  }
}

// src/commands/remove.ts
import * as p5 from "@clack/prompts";
async function removeCommand(ctx, serverName) {
  const store = new ConfigStore(ctx.projectRoot);
  if (!store.exists()) {
    p5.log.warn(`No ${GLOBAL_CONFIG_DISPLAY_PATH} found in this directory.`);
    p5.log.info('Run "mcpx init" to create a configuration.');
    return;
  }
  const config = store.load();
  const serverNames = Object.keys(config.servers);
  if (serverNames.length === 0) {
    p5.log.info("No MCP servers configured.");
    return;
  }
  let name;
  if (serverName && config.servers[serverName]) {
    name = serverName;
  } else {
    const selected = handleCancel(
      await p5.select({
        message: "Which server do you want to remove?",
        options: serverNames.map((n) => ({ value: n, label: n }))
      })
    );
    if (selected === BACK) return;
    name = selected;
  }
  const confirmed = handleCancel(
    await p5.confirm({ message: `Confirm removal of server "${name}"?`, initialValue: false })
  );
  if (confirmed === BACK || !confirmed) {
    p5.cancel("Operation canceled.");
    return;
  }
  const updatedConfig = store.removeServer(name);
  p5.log.success(`Server "${name}" removed.`);
  const registry = createRegistry();
  const providers = registry.getByNames(updatedConfig.providers);
  const results = syncAllProviders(providers, ctx.projectRoot, updatedConfig.servers);
  for (const r of results) {
    if (r.status === "error") {
      p5.log.error(`${r.filePath}: ${r.error}`);
    } else if (r.status !== "unchanged") {
      p5.log.success(`Updated: ${r.filePath}`);
    }
  }
}

// src/commands/list.ts
import * as p6 from "@clack/prompts";
import pc from "picocolors";
async function listCommand(ctx) {
  const store = new ConfigStore(ctx.projectRoot);
  if (!store.exists()) {
    p6.log.warn(`No ${GLOBAL_CONFIG_DISPLAY_PATH} found in this directory.`);
    p6.log.info('Run "mcpx init" to create a configuration.');
    return;
  }
  const config = store.load();
  const registry = createRegistry();
  const servers = Object.entries(config.servers);
  if (servers.length === 0) {
    p6.log.info("No MCP servers configured.");
    return;
  }
  const lines = servers.map(([name, server]) => {
    const status = server.enabled === false ? pc.dim(" [disabled]") : "";
    const cmd = server.transport === "stdio" ? `${server.command} ${(server.args ?? []).join(" ")}` : server.url ?? "";
    const desc = server.description ? pc.dim(` - ${server.description}`) : "";
    return `${pc.bold(name)} ${pc.dim(`(${server.transport})`)}${status}
  ${pc.cyan(cmd)}${desc}`;
  });
  p6.note(lines.join("\n\n"), "MCP Servers");
  const providerNames = config.providers.map((pn) => registry.get(pn)?.config.displayName ?? pn).join(", ");
  p6.log.info(`Enabled providers: ${providerNames || "none"}`);
}

// src/commands/sync.ts
import * as p7 from "@clack/prompts";
async function syncCommand(ctx) {
  const store = new ConfigStore(ctx.projectRoot);
  if (!store.exists()) {
    p7.log.warn(`No ${GLOBAL_CONFIG_DISPLAY_PATH} found in this directory.`);
    p7.log.info('Run "mcpx init" to create a configuration.');
    return;
  }
  const config = store.load();
  const registry = createRegistry();
  const providers = registry.getByNames(config.providers);
  if (providers.length === 0) {
    p7.log.warn("No providers configured.");
    return;
  }
  const sp = p7.spinner();
  sp.start("Syncing configurations...");
  const results = syncAllProviders(providers, ctx.projectRoot, config.servers);
  sp.stop("Sync complete.");
  let updated = 0;
  let created = 0;
  let unchanged = 0;
  let deleted = 0;
  let errors = 0;
  for (const result of results) {
    switch (result.status) {
      case "created":
        p7.log.success(`${result.filePath} (created)`);
        created++;
        break;
      case "updated":
        p7.log.success(`${result.filePath} (updated)`);
        updated++;
        break;
      case "unchanged":
        p7.log.step(`${result.filePath} (unchanged)`);
        unchanged++;
        break;
      case "deleted":
        p7.log.warn(`${result.filePath} (removed)`);
        deleted++;
        break;
      case "error":
        p7.log.error(`${result.filePath}: ${result.error}`);
        errors++;
        break;
    }
  }
  const parts = [];
  if (created > 0) parts.push(`${created} created`);
  if (updated > 0) parts.push(`${updated} updated`);
  if (deleted > 0) parts.push(`${deleted} removed`);
  if (unchanged > 0) parts.push(`${unchanged} unchanged`);
  if (errors > 0) parts.push(`${errors} errors`);
  p7.log.info(`${results.length} providers processed (${parts.join(", ")})`);
}

// src/commands/import.ts
import * as p8 from "@clack/prompts";
async function importCommand(ctx, providerArg) {
  const store = new ConfigStore(ctx.projectRoot);
  const registry = createRegistry();
  const detector = new ConfigDetector(ctx.projectRoot, registry);
  const detections = detector.detectAll();
  if (detections.length === 0) {
    p8.log.info("No existing MCP configuration detected in this directory.");
    return;
  }
  const lines = detections.map((det) => {
    const provider2 = registry.get(det.provider);
    return `${provider2?.config.displayName ?? det.provider} (${det.filePath}) - ${det.servers.length} server(s)`;
  });
  p8.note(lines.join("\n"), "Detected configurations");
  let selectedProvider;
  if (providerArg) {
    selectedProvider = providerArg;
  } else {
    const result = handleCancel(
      await p8.select({
        message: "Which provider should be imported?",
        options: detections.map((d) => {
          const provider2 = registry.get(d.provider);
          return {
            value: d.provider,
            label: provider2?.config.displayName ?? d.provider,
            hint: `${d.servers.length} servers`
          };
        })
      })
    );
    if (result === BACK) return;
    selectedProvider = result;
  }
  const provider = registry.get(selectedProvider);
  if (!provider) {
    p8.log.error(`Provider "${selectedProvider}" not found.`);
    return;
  }
  const content = readTextFile(provider.getConfigFilePath(ctx.projectRoot));
  const parsedServers = provider.parse(content);
  const serverNames = Object.keys(parsedServers);
  if (serverNames.length === 0) {
    p8.log.info("No servers found in that provider.");
    return;
  }
  const selectedServers = handleCancel(
    await p8.multiselect({
      message: "Which servers should be imported?",
      options: serverNames.map((name) => ({ value: name, label: name })),
      initialValues: serverNames
    })
  );
  if (selectedServers === BACK || selectedServers.length === 0) {
    p8.log.info("No servers selected.");
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
  p8.log.success(`Imported ${selectedServers.length} server(s) into ${GLOBAL_CONFIG_DISPLAY_PATH}`);
  if (config.providers.length > 0) {
    const doSync = handleCancel(
      await p8.confirm({ message: "Sync with the configured providers now?", initialValue: true })
    );
    if (doSync && doSync !== BACK) {
      const providers = registry.getByNames(config.providers);
      const results = syncAllProviders(providers, ctx.projectRoot, config.servers);
      for (const result of results) {
        if (result.status === "error") {
          p8.log.error(`${result.filePath}: ${result.error}`);
        } else if (result.status !== "unchanged") {
          p8.log.success(`${result.status === "created" ? "Created" : "Updated"}: ${result.filePath}`);
        }
      }
    }
  }
}

// src/commands/status.ts
import * as p9 from "@clack/prompts";
import pc2 from "picocolors";
async function statusCommand(ctx) {
  const store = new ConfigStore(ctx.projectRoot);
  if (!store.exists()) {
    p9.log.warn(`No ${GLOBAL_CONFIG_DISPLAY_PATH} found in this directory.`);
    p9.log.info('Run "mcpx init" to create a configuration.');
    return;
  }
  const config = store.load();
  const registry = createRegistry();
  const serverCount = Object.keys(config.servers).length;
  let hasDesync = false;
  const lines = [];
  for (const providerName of config.providers) {
    const provider = registry.get(providerName);
    if (!provider) continue;
    const filePath = provider.getConfigFilePath(ctx.projectRoot);
    const expectedContent = provider.generate(config.servers);
    const displayPath = provider.config.supportsProjectConfig ? provider.config.configPath : provider.config.globalConfigPath ?? provider.config.configPath;
    let status;
    if (!fileExists(filePath)) {
      status = pc2.red("missing");
      hasDesync = true;
    } else {
      const currentContent = readTextFile(filePath);
      if (currentContent === expectedContent) {
        status = pc2.green("sync");
      } else {
        status = pc2.yellow("desync");
        hasDesync = true;
      }
    }
    lines.push(`${pc2.bold(provider.config.displayName.padEnd(16))} ${displayPath.padEnd(30)} ${status}`);
  }
  p9.note(
    lines.join("\n"),
    `${serverCount} server(s), ${config.providers.length} provider(s)`
  );
  if (hasDesync) {
    p9.log.warn('Some providers are out of date. Run "mcpx sync" to update them.');
  } else {
    p9.log.success("All providers are synchronized.");
  }
}

// src/cli.ts
function createCli() {
  const program = new Command();
  program.name("mcpx").description("CLI for configuring MCP servers across multiple AI providers").version(package_default.version).option("-d, --dir <path>", "Project directory", process.cwd()).option("--verbose", "Show detailed logs", false);
  function getContext() {
    const opts = program.opts();
    return {
      projectRoot: opts["dir"],
      verbose: opts["verbose"]
    };
  }
  program.command("init").description("Interactive setup wizard").action(() => initCommand(getContext()));
  program.command("add").description("Add an MCP server").argument("[name]", "Server name").action((name) => addCommand(getContext(), name));
  program.command("remove").description("Remove an MCP server").argument("[name]", "Server name").action((name) => removeCommand(getContext(), name));
  program.command("list").description("List configured MCP servers").action(() => listCommand(getContext()));
  program.command("sync").description("Regenerate provider configuration files").action(() => syncCommand(getContext()));
  program.command("import").description("Import configuration from an existing provider").argument("[provider]", "Provider name").action((provider) => importCommand(getContext(), provider));
  program.command("status").description("Show provider sync status").action(() => statusCommand(getContext()));
  program.action(() => initCommand(getContext()));
  return program;
}

// bin/mcpx.ts
await createCli().parseAsync(process.argv);
