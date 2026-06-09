# 🔌 MCPX

> **One config to rule them all.** Configure your MCP servers once, deploy to every AI CLI automatically.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 😩 The Problem

Each AI CLI tool uses a **different file format** for configuring MCP (Model Context Protocol) servers:

| AI CLI | Config File | Format |
|--------|------------|--------|
| Claude Code | `.mcp.json` | JSON |
| Antigravity CLI (`gemini-cli`) | `~/.gemini/config/mcp_config.json` | JSON |
| Kimi CLI | `~/.kimi/mcp.json` | JSON |
| OpenAI Codex | `.codex/config.toml` | **TOML** |
| OpenCode | `~/.config/opencode/opencode.jsonc` (`opencode.json` fallback) | JSONC/JSON |
| GitHub Copilot CLI | `~/.copilot/mcp-config.json` | JSON |
| VS Code | `.vscode/mcp.json` | JSON |
| IntelliJ IDEA | `.idea/mcp.json` | JSON |

If you use multiple AI tools (and you probably do), you need to **manually maintain 8 different config files** with different structures, field names, and quirks. For **every single project**.

---

## ✨ The Solution

**MCPX** maintains a single canonical config file (`.mcpx.json`) per project and **automatically generates** the correct config file for each AI CLI provider you use.

```
.mcpx.json  ──────►  .mcp.json                     (Claude Code)
    │       ──────►  ~/.gemini/config/mcp_config.json (Antigravity CLI)
    │       ──────►  ~/.kimi/mcp.json               (Kimi CLI)
    │       ──────►  .codex/config.toml             (OpenAI Codex)
    │       ──────►  ~/.config/opencode/opencode.jsonc (OpenCode)
    │       ──────►  ~/.copilot/mcp-config.json     (Copilot CLI)
    │       ──────►  .vscode/mcp.json               (VS Code)
    └─────  ──────►  .idea/mcp.json                 (IntelliJ IDEA)
```

---

## 🚀 Quick Start

### 📦 Installation

```bash
npm install -g mcpx-cli
```

### ⚡ First Setup

Navigate to your project directory and run:

```bash
mcpx
```

The interactive wizard will guide you through:

1. 🔍 **Detection** — Automatically detects existing MCP configs in your project
2. 📥 **Import** — Offers to import servers from detected configs
3. ➕ **Add servers** — Interactive wizard to configure new MCP servers
4. 🎯 **Select providers** — Choose which AI CLIs you want to generate configs for
5. ⚙️ **Generate** — Creates `.mcpx.json` and all provider config files

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `mcpx` or `mcpx init` | 🧙 Interactive setup wizard |
| `mcpx add [name]` | ➕ Add a new MCP server |
| `mcpx remove [name]` | ➖ Remove an MCP server |
| `mcpx list` | 📄 List configured MCP servers |
| `mcpx sync` | 🔄 Regenerate all provider config files |
| `mcpx import [provider]` | 📥 Import config from an existing provider |
| `mcpx status` | 📊 Show sync status of all providers |

### 🏳️ Global Flags

| Flag | Description |
|------|-------------|
| `--dir, -d <path>` | 📁 Project directory (defaults to current) |
| `--verbose` | 🔊 Show detailed logs |
| `--version, -V` | 🏷️ Show version |
| `--help, -h` | ❓ Show help |

---

## 📐 Canonical Format

MCPX uses a single `.mcpx.json` file as the source of truth:

```json
{
  "version": 1,
  "providers": ["claude-code", "gemini-cli", "openai-codex", "copilot-cli"],
  "servers": {
    "jira": {
      "description": "Jira Atlassian",
      "transport": "stdio",
      "command": "uvx",
      "args": ["mcp-atlassian"],
      "env": {
        "JIRA_URL": "https://myorg.atlassian.net",
        "JIRA_USERNAME": "user@example.com",
        "JIRA_API_TOKEN": "your-token"
      }
    },
    "github": {
      "description": "GitHub MCP Server",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-github-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

### 📝 Server Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transport` | `"stdio"` \| `"http"` | ✅ Yes | Transport protocol |
| `command` | `string` | stdio | Executable command |
| `args` | `string[]` | — | Command arguments |
| `env` | `Record<string, string>` | — | Environment variables |
| `cwd` | `string` | — | Working directory |
| `url` | `string` | http | Server URL |
| `headers` | `Record<string, string>` | — | HTTP headers |
| `description` | `string` | — | Human-readable description |
| `enabled` | `boolean` | — | Enable/disable (default: `true`) |

---

## 🤖 Supported Providers

### 📁 Project-Scoped Providers

These providers generate config files **inside your project directory**. Each project has its own independent config.

#### 🟣 Claude Code

| Aspect | Detail |
|--------|--------|
| **File** | `.mcp.json` |
| **Format** | JSON |
| **Root key** | `mcpServers` |
| **Requires `type`** | Yes `"stdio"` |

#### 🟢 OpenAI Codex

| Aspect | Detail |
|--------|--------|
| **File** | `.codex/config.toml` |
| **Format** | **TOML** |
| **Root key** | `mcp_servers` |
| **Smart merge** | Yes — Preserves existing Codex settings (`model`, `approval_mode`, etc.) |

#### ⚫ GitHub Copilot CLI

| Aspect | Detail |
|--------|--------|
| **File** | `~/.copilot/mcp-config.json` |
| **Format** | JSON |
| **Root key** | `mcpServers` |
| **Scope** | Global — affects all projects |
| **Quirks** | Uses the shared global MCP config file in the user's home directory |

#### 🔷 VS Code

| Aspect | Detail |
|--------|--------|
| **File** | `.vscode/mcp.json` |
| **Format** | JSON |
| **Root key** | `servers` |
| **Quirks** | `type` field required (`"stdio"` or `"sse"`), HTTP mapped as `"sse"` |

#### 🟧 IntelliJ IDEA

| Aspect | Detail |
|--------|--------|
| **File** | `.idea/mcp.json` |
| **Format** | JSON |
| **Root key** | `mcpServers` |
| **Quirks** | No `type` field, infers from `command` vs `url` |

### 🌍 Global Providers

These providers use a **single global config file** shared across all projects. Running `mcpx sync` overwrites the global file with the current project's servers.

#### 🔴 Kimi CLI

| Aspect | Detail |
|--------|--------|
| **File** | `~/.kimi/mcp.json` |
| **Format** | JSON |
| **Root key** | `mcpServers` |
| **Scope** | Global — affects all projects |

#### 🔵 Antigravity CLI (`gemini-cli`)

| Aspect | Detail |
|--------|--------|
| **File** | `~/.gemini/config/mcp_config.json` |
| **Format** | JSON |
| **Root key** | `mcpServers` |
| **Scope** | Global — shared across Antigravity CLI and IDE |
| **Quirks** | Uses `serverUrl` for remote MCP servers |

#### 🟠 OpenCode

| Aspect | Detail |
|--------|--------|
| **File** | `~/.config/opencode/opencode.jsonc` |
| **Fallback** | `~/.config/opencode/opencode.json` when `.jsonc` does not exist |
| **Format** | JSONC / JSON |
| **Root key** | `mcp` |
| **Scope** | Global — affects all projects |
| **Quirks** | `command` is an array (command + args merged), uses `environment` instead of `env`, `type: "local"` |

---

## 🔄 Sync & Provider Management

### 🔁 Syncing

After modifying `.mcpx.json` (manually or via commands), regenerate all provider configs:

```bash
mcpx sync
```

For providers that share their config file with non-MCP settings, MCPX replaces only the provider's MCP section and preserves unrelated top-level settings.

### 🔀 Changing Providers

Use the interactive wizard to add or remove providers:

```bash
mcpx init
# Select "Change providers"
```

When a provider is **removed**, MCPX **deletes** the corresponding config file. For global providers, legacy project-level files are also cleaned up.

### 📥 Importing from Existing Configs

Already have MCP servers configured in one of your AI tools? Import them:

```bash
mcpx import
```

MCPX detects existing project-level configs (`.mcp.json`, `.vscode/mcp.json`, etc.) and lets you select which servers to import into `.mcpx.json`. Global providers such as Antigravity CLI, Kimi CLI, OpenCode, and Copilot CLI are not auto-detected by the project wizard.

---

## 🏗️ Architecture

```
src/
├── cli.ts                    # Commander setup & routing
├── types/
│   ├── canonical.ts          # McpConfigFile, McpServerConfig (Zod schemas)
│   ├── providers.ts          # Provider interface
│   └── common.ts             # CommandContext, SyncResult
├── commands/
│   ├── init.ts               # Interactive wizard
│   ├── add.ts / remove.ts    # Server management
│   ├── list.ts / status.ts   # Display info
│   ├── sync.ts               # Regenerate configs
│   └── import.ts             # Import from providers
├── providers/
│   ├── base.ts               # Provider interface
│   ├── registry.ts           # Provider registry (factory)
│   ├── claude-code.ts        # .mcp.json
│   ├── gemini-cli.ts         # ~/.gemini/config/mcp_config.json
│   ├── kimi-cli.ts           # ~/.kimi/mcp.json
│   ├── openai-codex.ts       # .codex/config.toml
│   ├── opencode.ts           # ~/.config/opencode/opencode.jsonc
│   ├── copilot-cli.ts        # ~/.copilot/mcp-config.json
│   ├── vscode.ts             # .vscode/mcp.json
│   └── intellij.ts           # .idea/mcp.json
├── core/
│   ├── config-store.ts       # .mcpx.json read/write
│   ├── detector.ts           # Detect existing configs
│   └── merger.ts             # Smart sync with merge support
├── wizard/
│   ├── main-wizard.ts        # Main interactive flow
│   ├── server-wizard.ts      # Server creation wizard
│   ├── provider-wizard.ts    # Provider selection
│   └── step-runner.ts        # Step navigation (back support)
└── utils/
    ├── fs.ts                 # File system helpers
    ├── logger.ts             # Logger with colors
    └── validation.ts         # Zod validation
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run once (CI)
npm run test:run

# Type checking
npm run typecheck
```

---

## 🛠️ Tech Stack

| Category | Library |
|----------|---------|
| 💻 Language | TypeScript 5.x (ESM) |
| 📦 Build | tsup (esbuild) |
| ⌨️ CLI Framework | commander |
| 💬 Interactive Prompts | @clack/prompts |
| 🎨 Colors | picocolors |
| 📄 TOML | smol-toml |
| ✅ Validation | zod |
| 🧪 Tests | vitest |
| 🟢 Min Node | >= 20 |

---

## 📄 License

MIT
