import { NextRequest, NextResponse } from 'next/server';
import { MusicMcpServer } from '@/lib/mcp/musicMcpServer';

/**
 * Model Context Protocol (MCP) HTTP Server Endpoint
 * Implements MCP JSON-RPC 2.0 protocol for agentic tool discovery and execution.
 */
export async function GET() {
  return NextResponse.json({
    jsonrpc: '2.0',
    server: MusicMcpServer.SERVER_INFO,
    tools: MusicMcpServer.listTools(),
    endpoints: {
      jsonrpc: '/api/mcp',
      coverArtSearch: '/api/ai/cover-art-search',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Standard MCP JSON-RPC 2.0 Request handling
    const { jsonrpc, id, method, params } = body;

    if (jsonrpc && jsonrpc !== '2.0') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
      });
    }

    // 1. MCP Initialization
    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MusicMcpServer.SERVER_INFO.protocolVersion,
          serverInfo: {
            name: MusicMcpServer.SERVER_INFO.name,
            version: MusicMcpServer.SERVER_INFO.version,
          },
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
        },
      });
    }

    // 2. Tools List
    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MusicMcpServer.listTools(),
        },
      });
    }

    // 3. Tools Call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (!toolName) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Invalid params: tool name is required' },
        });
      }

      try {
        const toolResult = await MusicMcpServer.callTool(toolName, toolArgs);
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
              },
            ],
            isError: false,
          },
        });
      } catch (toolErr: any) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Tool execution failed: ${toolErr.message || String(toolErr)}`,
              },
            ],
            isError: true,
          },
        });
      }
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (err: any) {
    console.error('[MCP Route Error]', err);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal error: ' + (err.message || String(err)) },
      },
      { status: 500 }
    );
  }
}
