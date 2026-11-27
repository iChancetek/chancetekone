/**
 * ChanceTEK One — Browser-Safe Wyres Telemetry Bridge
 *
 * Batches client-side AI Agent, Copilot, Assistant, Radio AI, Ingestion, Cover Art,
 * Healing, and Export Agent metrics and dispatches them cleanly to `/api/ai/telemetry`,
 * which authenticates server-side with WYRES_API_KEY before forwarding to Wyres.us.
 *
 * Mobile-thermal safe: batches up to 8 spans or 2.5s idle window so radio antennas stay cool.
 */

export type ClientWyresRunType = 'llm' | 'agent' | 'tool' | 'chain' | 'retriever' | 'embedding';

export interface ClientWyresEvent {
  id?: string;
  traceId?: string;
  parentRunId?: string | null;
  name: string;
  runType: ClientWyresRunType;
  provider?: string;
  model?: string;
  category?:
    | 'agentic_agent'
    | 'ai_assistant'
    | 'copilot'
    | 'llm'
    | 'voice_ai'
    | 'radio_ai'
    | 'mcp_agent'
    | 'rag_retriever'
    | 'ingestion_agent'
    | 'healing_agent'
    | 'export_agent';
  feature?: string;
  status?: 'success' | 'error';
  startTime?: string;
  endTime?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  input?: Record<string, any> | null;
  output?: Record<string, any> | null;
  error?: string | null;
  tags?: string[];
  metadata?: Record<string, any>;
  userId?: string;
}

const MAX_BATCH_SIZE = 8;
const FLUSH_DELAY_MS = 2500;

let pendingQueue: ClientWyresEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unloadBound = false;

function bindUnloadFlush() {
  if (unloadBound || typeof window === 'undefined') return;
  unloadBound = true;
  window.addEventListener('pagehide', () => {
    flushClientWyresQueue(true);
  });
}

export function flushClientWyresQueue(useBeacon = false): void {
  if (typeof window === 'undefined' || pendingQueue.length === 0) return;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = pendingQueue.splice(0, pendingQueue.length);
  const bodyStr = JSON.stringify({ events: batch });

  try {
    if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([bodyStr], { type: 'application/json' });
      navigator.sendBeacon('/api/ai/telemetry', blob);
      return;
    }

    void fetch('/api/ai/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    }).catch(() => {
      // Telemetry failures are always silent in the UI
    });
  } catch {
    // Never interrupt client UX
  }
}

/**
 * Queues a client-side AI event to be forwarded securely to Wyres via `/api/ai/telemetry`.
 * Safe to call in both browser and SSR contexts (no-ops cleanly during SSR unless routed server-side).
 */
export function reportClientAiMetric(event: ClientWyresEvent): void {
  if (typeof window === 'undefined') return;

  bindUnloadFlush();
  const nowIso = new Date().toISOString();
  pendingQueue.push({
    ...event,
    startTime: event.startTime || nowIso,
    endTime: event.endTime || nowIso,
    latencyMs: typeof event.latencyMs === 'number' ? Math.max(0, Math.round(event.latencyMs)) : 0,
    status: event.status || (event.error ? 'error' : 'success'),
    metadata: {
      source: 'browser',
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
      ...(event.metadata || {}),
    },
  });

  if (pendingQueue.length >= MAX_BATCH_SIZE) {
    flushClientWyresQueue(false);
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushClientWyresQueue(false);
    }, FLUSH_DELAY_MS);
  }
}

/**
 * Convenience timer wrapper for client-side autonomous AI agents & copilots.
 */
export async function traceClientAiAgent<T>(
  meta: Omit<ClientWyresEvent, 'startTime' | 'endTime' | 'latencyMs' | 'status' | 'error' | 'output'> & {
    extractOutput?: (result: T) => Record<string, any> | null;
  },
  fn: () => Promise<T> | T
): Promise<T> {
  const startedMs = Date.now();
  const startTime = new Date(startedMs).toISOString();

  try {
    const result = await fn();
    const endedMs = Date.now();
    reportClientAiMetric({
      ...meta,
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      status: 'success',
      output: meta.extractOutput ? meta.extractOutput(result) : undefined,
      error: null,
    });
    return result;
  } catch (err: any) {
    const endedMs = Date.now();
    reportClientAiMetric({
      ...meta,
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      status: 'error',
      output: null,
      error: err?.message || String(err),
    });
    throw err;
  }
}

