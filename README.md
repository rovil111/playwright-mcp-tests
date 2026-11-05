# Playwright MCP Tests

![tests](https://github.com/rovil111/playwright-mcp-tests/actions/workflows/tests.yml/badge.svg)

When an AI agent drives a browser, its tool layer becomes part of the system under test. This suite starts the [Playwright MCP](https://github.com/microsoft/playwright-mcp) server the way an agent host does and checks what an agent would actually see and rely on, with no model in the loop, so results are deterministic.

## Run it

Requires Node.js 20 or later and Google Chrome.

```bash
npm ci
npm test
```

| Variable | Purpose |
| --- | --- |
| `MCP_BROWSER=msedge` | Use Microsoft Edge instead of Chrome |
| `MCP_EXECUTABLE_PATH` | Use a specific browser binary |
| `MCP_NO_SANDBOX=1` | Needed in some containers and CI runners |

## What it covers

| Area | Why it matters to an agent |
| --- | --- |
| Tool contract | Agents choose tools from their names, descriptions and schemas, so a change there can break them silently |
| Snapshot quality | Roles, names and refs are all the agent has to act on |
| Full journey | Snapshot, type, click, then re-read the page to confirm the outcome |
| Failure behaviour | An invalid ref must return an error, or the agent will assume it succeeded |
| Hidden content | Text hidden from users should not reach the agent as a prompt-injection path |

The server version is pinned on purpose, so an upgrade that changes the contract shows up as a failing test in a reviewed pull request.

## Scope of the safety test

It covers the HTML `hidden` attribute only. It doesn't show that an agent is protected from injection, since visible page text still reaches the model.
