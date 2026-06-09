# AGENTS.md

## Verify First
- Install deps with `npm install` before running repo scripts. The checked-in repo does not include `node_modules`.
- Current checked-in status: `npm run build`, `npm run typecheck`, `npm run lint`, and `npm run test:run` all pass.
- Use `npm run test:run` for the fastest reliable verification pass; run the full script set when you touch CLI wiring or toolchain config.

## Repo Shape
- This is a single-package Node 20+ ESM TypeScript CLI, not a monorepo.
- Canonical project state lives in `~/.agents/mcp.json`; `src/core/config-store.ts` is the read/write entrypoint and validates via Zod schemas in `src/types/canonical.ts`.
- CLI wiring lives in `src/cli.ts`. Running `mcpx` with no subcommand falls through to `init`.
- Provider registration is centralized in `src/providers/registry.ts`. Add new providers there or they will not participate in detect/import/sync flows.
- Sync behavior lives in `src/core/merger.ts`; provider-specific file formats live one-per-file under `src/providers/`.

## High-Risk Behaviors
- `mcpx sync` can write outside the repo. `KimiCliProvider`, `AntigravityCliProvider`, `OpenCodeProvider`, and `CopilotCliProvider` target global config files in the user's home directory.
- `ConfigDetector` only auto-detects project-scoped providers; it intentionally skips global providers such as Kimi.

## Provider Quirks Worth Remembering
- OpenCode config generation is lossy by design: `src/providers/opencode.ts` rewrites `~/.config/opencode/opencode.jsonc` (falling back to `~/.config/opencode/opencode.json` when needed) from canonical data and maps stdio servers to `type: "local"` with `command` as a merged array.
- `AntigravityCliProvider` targets Antigravity's shared MCP config at `~/.gemini/config/mcp_config.json` and maps canonical HTTP transport to `serverUrl`.
- JSON-based providers preserve unrelated top-level settings while replacing their MCP section; OpenAI Codex does the same for TOML via object-level merge.
- VS Code maps canonical HTTP transport to `type: "sse"`; IntelliJ infers transport from `command` vs `url`; Copilot uses the global `~/.copilot/mcp-config.json` file.

## Tests
- Tests are plain Vitest files under `tests/**/*.test.ts`; config is minimal in `vitest.config.ts`.
- Run a focused suite with `npx vitest run tests/providers/opencode.test.ts`.
- Provider tests are the best safety net for format changes; there are no integration tests for the interactive wizard or cross-tool side effects.

## Working Style
- Keep CLI text, comments, tests, and docs in English.
