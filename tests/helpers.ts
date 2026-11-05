import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** Serves the fixture page locally, so tests never depend on an external site. */
export async function startFixtureSite(): Promise<{ url: string; server: Server }> {
  const page = readFileSync(new URL('../fixtures/login.html', import.meta.url));
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, server };
}

/**
 * Starts the server the same way an agent host does: as a child process over stdio.
 * MCP_BROWSER picks an installed browser (chrome by default, msedge also works).
 * MCP_EXECUTABLE_PATH points at a specific browser binary.
 */
export async function connectMcp(): Promise<Client> {
  const args = [fileURLToPath(new URL('../node_modules/@playwright/mcp/cli.js', import.meta.url)), '--headless', '--isolated', '--browser', process.env.MCP_BROWSER ?? 'chrome'];
  if (process.env.MCP_EXECUTABLE_PATH) args.push('--executable-path', process.env.MCP_EXECUTABLE_PATH);
  if (process.env.MCP_NO_SANDBOX) args.push('--no-sandbox');
  const client = new Client({ name: 'playwright-mcp-tests', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args }));
  return client;
}

export interface ToolOutput {
  text: string;
  isError: boolean;
}

export async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolOutput> {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  return {
    text: result.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n'),
    isError: result.isError === true,
  };
}

/** Reads an element's ref from an accessibility snapshot, as an agent would. */
export function refFor(snapshot: string, role: string, name: string): string {
  const match = snapshot.match(new RegExp(`${role} "${name}"[^\\n]*\\[ref=(\\w+)\\]`));
  if (!match) throw new Error(`No ${role} "${name}" in snapshot:\n${snapshot}`);
  return match[1]!;
}
