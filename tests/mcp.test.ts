import type { Server } from 'node:http';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { callTool, connectMcp, refFor, startFixtureSite } from './helpers.js';

let client: Client;
let site: { url: string; server: Server };

beforeAll(async () => {
  site = await startFixtureSite();
  client = await connectMcp();
});

afterAll(async () => {
  await client?.close();
  site?.server.close();
});

describe('tool contract', () => {
  it('exposes the tools an agent relies on', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const name of ['browser_navigate', 'browser_snapshot', 'browser_click', 'browser_type', 'browser_wait_for']) {
      expect(names).toContain(name);
    }
  });

  it('describes every tool, because an agent chooses tools from descriptions', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema.type, tool.name).toBe('object');
    }
  });

  it('declares url as required on browser_navigate', async () => {
    const { tools } = await client.listTools();
    const navigate = tools.find((t) => t.name === 'browser_navigate')!;
    expect(navigate.inputSchema.required).toContain('url');
  });
});

describe('agent journey', () => {
  beforeEach(async () => {
    const opened = await callTool(client, 'browser_navigate', { url: site.url });
    expect(opened.isError).toBe(false);
  });

  it('the snapshot gives the agent roles, names and usable refs', async () => {
    const { text } = await callTool(client, 'browser_snapshot');
    expect(text).toContain('heading "Sign in"');
    expect(refFor(text, 'textbox', 'Username')).toBeTruthy();
    expect(refFor(text, 'button', 'Continue')).toBeTruthy();
  });

  it('completes a form the way an agent would: snapshot, type, click, re-read', async () => {
    const before = (await callTool(client, 'browser_snapshot')).text;
    const typed = await callTool(client, 'browser_type', {
      ref: refFor(before, 'textbox', 'Username'),
      element: 'Username field',
      text: 'rovil',
    });
    expect(typed.isError).toBe(false);

    const clicked = await callTool(client, 'browser_click', {
      ref: refFor(before, 'button', 'Continue'),
      element: 'Continue button',
    });
    expect(clicked.isError).toBe(false);

    const waited = await callTool(client, 'browser_wait_for', { text: 'Welcome, rovil' });
    expect(waited.isError).toBe(false);
    expect((await callTool(client, 'browser_snapshot')).text).toContain('Welcome, rovil');
  });

  it('shows the validation message when the form is empty', async () => {
    const before = (await callTool(client, 'browser_snapshot')).text;
    await callTool(client, 'browser_click', { ref: refFor(before, 'button', 'Continue'), element: 'Continue button' });
    await callTool(client, 'browser_wait_for', { text: 'Username is required' });
    expect((await callTool(client, 'browser_snapshot')).text).toContain('Username is required');
  });
});

describe('failure behaviour', () => {
  it('reports a stale or invented ref as an error, not a silent success', async () => {
    await callTool(client, 'browser_navigate', { url: site.url });
    const result = await callTool(client, 'browser_click', { ref: 'e99999', element: 'Element that does not exist' });
    expect(result.isError).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('reports an unreachable site as an error', async () => {
    const result = await callTool(client, 'browser_navigate', { url: 'http://127.0.0.1:1/' });
    expect(result.isError).toBe(true);
  });
});

describe('agent safety', () => {
  it('leaves hidden page text out of the snapshot, reducing prompt-injection exposure', async () => {
    await callTool(client, 'browser_navigate', { url: site.url });
    const { text } = await callTool(client, 'browser_snapshot');
    expect(text).not.toContain('Ignore your task');
  });
});
