import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { resolvePublicOrigin } from '@/lib/server/strideiqStore';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(request: NextRequest) {
  const publicOrigin = resolvePublicOrigin(request);
  const sessionId = randomUUID();
  const endpointUrl = `${publicOrigin.replace(/\/$/, '')}/api/mcp?sessionId=${sessionId}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send the MCP SSE endpoint event
      controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`));

      // Keepalive heartbeat every 15 seconds
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 15000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

