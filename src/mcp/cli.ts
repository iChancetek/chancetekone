#!/usr/bin/env node
/**
 * ChanceTEK One MCP Server CLI
 *
 * Runs the ChanceTEK One Model Context Protocol (MCP) server over standard input/output (stdio)
 * for desktop and CLI MCP clients: Claude Desktop, Antigravity, Cursor, Windsurf, Claude Code, Zed.
 *
 * Usage:
 *   npx tsx src/mcp/cli.ts
 *   node bin/chancetek-mcp.js
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createChanceTekMcpServer } from './server';

async function main() {
  const publicOrigin = (process.env.CHANCETEK_PUBLIC_ORIGIN || process.env.CHANCETEK_BASE_URL || 'https://chancetekone.us').replace(/\/+$/, '');
  const server = createChanceTekMcpServer({ publicOrigin });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Send a diagnostic notice to stderr so stdout remains pure JSON-RPC
  console.error(`[ChanceTEK One MCP] Server running on stdio (origin: ${publicOrigin})`);
}

main().catch((err) => {
  console.error('[ChanceTEK One MCP] Fatal startup error:', err);
  process.exit(1);
});

