/**
 * ChanceTEK One — Wyres Live AI Telemetry SDK (by ChanceTEK)
 *
 * Streams structured run traces and metrics from all Agentic AI Agents, Copilots,
 * LLMs, AI Assistants, Voice AI (Whisper/TTS), AI Radio Agents, RAG Retrievers,
 * and MCP Servers to Wyres (https://wyres.us/v1/traces).
 *
 * Recognizes both primary WYRES_* env vars and CHANCETEK_IQ_* backward-compatibility aliases.
 * All emission is non-blocking and fault-tolerant so telemetry never slows down or interrupts UX.
 */

import type OpenAI from 'openai';

export type WyresRunType = 'llm' | 'agent' | 'tool' | 'chain' | 'retriever' | 'embedding';

export type WyresAiCategory =
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

export interface WyresStep {
  id: string;
  parentRunId: string;
  name: string;
  runType: WyresRunType;
  status: 'success' | 'error';
  model: string;
  provider: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  startTime: string;
  endTime: string;
  input?: Record<string, any> | null;
  output?: Record<string, any> | null;
  error?: string | null;
}

export interface WyresTracePayload {
  id?: string;
  traceId?: string;
  parentRunId?: string | null;
  name: string;
  runType: WyresRunType;
  provider?: string;
  model?: string;
  category?: WyresAiCategory;
  feature?: string;
  status?: 'success' | 'error';
  startTime?: string;
  endTime?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  input?: Record<string, any> | null;
  output?: Record<string, any> | null;
  error?: string | null;
  tags?: string[];
  steps?: WyresStep[];
  metadata?: Record<string, any>;
  userId?: string;
}

export interface WyresConfig {
  enabled: boolean;
  apiKey: string;
  project: string;
  environment: string;
  endpoint: string;
  platform: string;
  service: string;
}

interface TelemetryRuntimeStats {
  sentCount: number;
  failedCount: number;
  lastSentAt: string | null;
  lastError: string | null;
  lastTraceId: string | null;
}

const runtimeStats: TelemetryRuntimeStats = {
  sentCount: 0,
  failedCount: 0,
  lastSentAt: null,
  lastError: null,
  lastTraceId: null,
};

function cleanEnv(value: string | undefined): string {
  return (value || '').trim().replace(/^["']|["']$/g, '');
}

/**
 * Resolves Wyres configuration from WYRES_* env vars with automatic fallback
 * to CHANCETEK_IQ_* backward-compatibility aliases.
 */
export function getWyresConfig(): WyresConfig {
  const apiKey = cleanEnv(process.env.WYRES_API_KEY) || cleanEnv(process.env.CHANCETEK_IQ_API_KEY);
  const project =
    cleanEnv(process.env.WYRES_PROJECT) ||
    cleanEnv(process.env.CHANCETEK_IQ_PROJECT) ||
    'chancetek-one';
  const environment =
    cleanEnv(process.env.WYRES_ENVIRONMENT) ||
    cleanEnv(process.env.NODE_ENV) ||
    'production';
  const endpoint =
    cleanEnv(process.env.WYRES_ENDPOINT) ||
    cleanEnv(process.env.CHANCETEK_IQ_ENDPOINT) ||
    'https://wyres.us/v1/traces';

  const tracingFlag = cleanEnv(process.env.WYRES_TRACING).toLowerCase();
  const explicitlyDisabled = tracingFlag === 'false' || tracingFlag === '0' || tracingFlag === 'off';
  const enabled = !explicitlyDisabled && Boolean(apiKey);

  return {
    enabled,
    apiKey,
    project,
    environment,
    endpoint,
    platform: 'chancetekone.us',
    service: 'ChanceTEK One',
  };
}

export function getWyresStatus() {
  const cfg = getWyresConfig();
  return {
    enabled: cfg.enabled,
    project: cfg.project,
    environment: cfg.environment,
    endpoint: cfg.endpoint,
    platform: cfg.platform,
    service: cfg.service,
    keyConfigured: Boolean(cfg.apiKey),
    keyPrefix: cfg.apiKey ? `${cfg.apiKey.slice(0, 12)}...` : null,
    stats: { ...runtimeStats },
  };
}

export function generateWyresId(prefix = 'wyr'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fallback below
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Estimates USD inference cost across LLM, Whisper, and TTS models.
 */
export function estimateWyresCost(params: {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  inputChars?: number;
  audioDurationSeconds?: number;
}): number {
  const model = (params.model || '').toLowerCase();
  const promptTokens = Math.max(0, Number(params.promptTokens || 0));
  const completionTokens = Math.max(0, Number(params.completionTokens || 0));

  if (model.includes('tts-1-hd')) {
    const chars = Math.max(0, Number(params.inputChars || 0));
    return Number(((chars / 1_000_000) * 30).toFixed(6));
  }
  if (model.includes('tts')) {
    const chars = Math.max(0, Number(params.inputChars || 0));
    return Number(((chars / 1_000_000) * 15).toFixed(6));
  }
  if (model.includes('whisper')) {
    const minutes = Math.max(0.1, Number(params.audioDurationSeconds || 10) / 60);
    return Number((minutes * 0.006).toFixed(6));
  }
  if (model.includes('embedding')) {
    return Number(((promptTokens / 1_000_000) * 0.02).toFixed(6));
  }
  if (promptTokens === 0 && completionTokens === 0) {
    return 0;
  }

  // Per-1M token pricing estimates aligned with Wyres cost model
  let inputPerMillion = 1.25;
  let outputPerMillion = 10.0;
  if (model.includes('mini') || model.includes('nano')) {
    inputPerMillion = 0.25;
    outputPerMillion = 2.0;
  } else if (model.includes('terra') || model.includes('gpt-5') || model.includes('gpt-6')) {
    inputPerMillion = 2.5;
    outputPerMillion = 10.0;
  } else if (model.includes('gpt-4o')) {
    inputPerMillion = 2.5;
    outputPerMillion = 10.0;
  }

  const usd = (promptTokens / 1_000_000) * inputPerMillion + (completionTokens / 1_000_000) * outputPerMillion;
  return Number(usd.toFixed(6));
}

/**
 * Recursively strips undefined values, binary data URIs, and oversized strings
 * so trace payloads remain compact, safe, and fast to ingest.
 */
function sanitizeForWyres(value: any, depth = 0): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number') {
    return Number.isFinite(value) || typeof value === 'boolean' ? value : null;
  }
  if (typeof value === 'string') {
    if (value.startsWith('data:audio/') || value.startsWith('data:image/')) {
      return value.length > 256 ? `[data-uri-omitted:${value.length}B]` : value;
    }
    return value.length > 4000 ? `${value.slice(0, 4000)}…[truncated:${value.length}]` : value;
  }
  if (depth >= 5) return '[nested]';
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeForWyres(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    const keys = Object.keys(value).slice(0, 40);
    for (const k of keys) {
      const v = value[k];
      if (v === undefined || typeof v === 'function') continue;
      const lowerKey = k.toLowerCase();
      if (lowerKey.includes('apikey') || lowerKey.includes('api_key') || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('authorization')) {
        out[k] = '[redacted]';
      } else {
        out[k] = sanitizeForWyres(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

/**
 * Emits a single structured run trace to Wyres (https://wyres.us/v1/traces).
 * Returns true if acknowledged by Wyres, false if disabled or failed.
 * Never throws.
 */
export async function emitWyresTrace(payload: WyresTracePayload): Promise<{
  ok: boolean;
  traceId: string;
  id: string;
  status?: number;
  error?: string;
}> {
  const cfg = getWyresConfig();
  const id = payload.id || generateWyresId('wyr_run');
  const traceId = payload.traceId || id;

  if (!cfg.enabled) {
    return { ok: false, traceId, id, error: 'Wyres tracing disabled or API key missing' };
  }

  const nowIso = new Date().toISOString();
  const startTime = payload.startTime || nowIso;
  const endTime = payload.endTime || nowIso;
  const latencyMs =
    typeof payload.latencyMs === 'number' && Number.isFinite(payload.latencyMs)
      ? Math.max(0, Math.round(payload.latencyMs))
      : Math.max(0, new Date(endTime).getTime() - new Date(startTime).getTime());

  const provider = payload.provider || 'chancetek-agent';
  const model = payload.model || 'unknown';
  const promptTokens = Math.max(0, Number(payload.promptTokens || 0));
  const completionTokens = Math.max(0, Number(payload.completionTokens || 0));
  const totalTokens = Math.max(0, Number(payload.totalTokens ?? promptTokens + completionTokens));
  const estimatedCost =
    typeof payload.estimatedCost === 'number' && Number.isFinite(payload.estimatedCost)
      ? payload.estimatedCost
      : estimateWyresCost({ model, promptTokens, completionTokens });

  const category = payload.category || (payload.runType === 'llm' ? 'llm' : 'agentic_agent');
  const feature = payload.feature || payload.name;

  const uniqueTags = Array.from(
    new Set(
      [
        cfg.project,
        cfg.environment,
        provider,
        payload.runType,
        category,
        'wyres',
        ...(payload.tags || []),
      ].filter((t): t is string => Boolean(t && typeof t === 'string'))
    )
  ).slice(0, 16);

  const body = {
    id,
    traceId,
    parentRunId: payload.parentRunId ?? null,
    name: payload.name,
    runType: payload.runType,
    project: cfg.project,
    provider,
    model,
    status: payload.status || (payload.error ? 'error' : 'success'),
    startTime,
    endTime,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost,
    input: payload.input ? sanitizeForWyres(payload.input) : null,
    output: payload.output ? sanitizeForWyres(payload.output) : null,
    error: payload.error ?? null,
    tags: uniqueTags,
    steps: payload.steps ? sanitizeForWyres(payload.steps) : [],
    ...(payload.userId ? { userId: String(payload.userId) } : {}),
    metadata: sanitizeForWyres({
      platform: cfg.platform,
      service: cfg.service,
      environment: cfg.environment,
      feature,
      category,
      ls_provider: provider,
      ls_model_name: model,
      latency_ms: latencyMs,
      ...(payload.metadata || {}),
    }),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        'x-wyres-key': cfg.apiKey,
        'x-api-key': cfg.apiKey,
        'x-project': cfg.project,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const errMsg = `HTTP ${res.status}${errText ? `: ${errText.slice(0, 180)}` : ''}`;
      runtimeStats.failedCount += 1;
      runtimeStats.lastError = errMsg;
      return { ok: false, traceId, id, status: res.status, error: errMsg };
    }

    runtimeStats.sentCount += 1;
    runtimeStats.lastSentAt = new Date().toISOString();
    runtimeStats.lastTraceId = traceId;
    return { ok: true, traceId, id, status: res.status };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    runtimeStats.failedCount += 1;
    runtimeStats.lastError = errMsg;
    return { ok: false, traceId, id, error: errMsg };
  }
}

/**
 * Fire-and-forget wrapper that emits a trace without blocking request completion.
 */
export function emitWyresTraceAsync(payload: WyresTracePayload): { traceId: string; id: string } {
  const id = payload.id || generateWyresId('wyr_run');
  const traceId = payload.traceId || id;
  void emitWyresTrace({ ...payload, id, traceId });
  return { traceId, id };
}

/**
 * Wraps any AI Agent, Tool, Retriever, or Chain execution and automatically captures
 * timing, status, errors, inputs, and outputs for Wyres.
 */
export async function traceWyresExecution<T>(
  config: Omit<WyresTracePayload, 'startTime' | 'endTime' | 'latencyMs' | 'status' | 'error' | 'output'> & {
    extractOutput?: (result: T) => Record<string, any> | null;
    extractUsage?: (result: T) => {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      estimatedCost?: number;
      model?: string;
    };
  },
  fn: (ctx: { traceId: string; runId: string }) => Promise<T>
): Promise<T> {
  const runId = config.id || generateWyresId('wyr_run');
  const traceId = config.traceId || runId;
  const startedMs = Date.now();
  const startTime = new Date(startedMs).toISOString();

  try {
    const result = await fn({ traceId, runId });
    const endedMs = Date.now();
    const usage = config.extractUsage ? config.extractUsage(result) : undefined;
    const output = config.extractOutput
      ? config.extractOutput(result)
      : result && typeof result === 'object'
      ? (result as Record<string, any>)
      : { value: result };

    emitWyresTraceAsync({
      ...config,
      id: runId,
      traceId,
      model: usage?.model || config.model,
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      promptTokens: usage?.promptTokens ?? config.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? config.completionTokens ?? 0,
      totalTokens: usage?.totalTokens ?? config.totalTokens,
      estimatedCost: usage?.estimatedCost ?? config.estimatedCost,
      status: 'success',
      output,
      error: null,
    });

    return result;
  } catch (err: any) {
    const endedMs = Date.now();
    emitWyresTraceAsync({
      ...config,
      id: runId,
      traceId,
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

/**
 * Instrumented OpenAI Chat Completions helper.
 * Automatically captures model, messages, token usage, cost, finish reason, tool calls, and latency.
 */
export async function tracedOpenAIChatCompletion(
  openai: OpenAI,
  params: any,
  ctx: {
    name: string;
    feature: string;
    category?: WyresAiCategory;
    traceId?: string;
    parentRunId?: string | null;
    userId?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }
): Promise<any> {
  const runId = generateWyresId('wyr_llm');
  const traceId = ctx.traceId || runId;
  const startedMs = Date.now();
  const startTime = new Date(startedMs).toISOString();
  const requestedModel = String(params?.model || 'unknown');

  try {
    const response: any = await openai.chat.completions.create(params);
    const endedMs = Date.now();
    const usage = response?.usage || {};
    const promptTokens = Number(usage.prompt_tokens || 0);
    const completionTokens = Number(usage.completion_tokens || 0);
    const totalTokens = Number(usage.total_tokens || promptTokens + completionTokens);
    const resolvedModel = String(response?.model || requestedModel);
    const estimatedCost = estimateWyresCost({
      model: resolvedModel,
      promptTokens,
      completionTokens,
    });

    const firstChoice = response?.choices?.[0];
    const toolCallCount = firstChoice?.message?.tool_calls?.length || 0;

    emitWyresTraceAsync({
      id: runId,
      traceId,
      parentRunId: ctx.parentRunId ?? null,
      name: ctx.name,
      runType: 'llm',
      provider: 'openai',
      model: resolvedModel,
      category: ctx.category || 'llm',
      feature: ctx.feature,
      status: 'success',
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      userId: ctx.userId,
      input: {
        model: requestedModel,
        messageCount: Array.isArray(params?.messages) ? params.messages.length : 0,
        messages: Array.isArray(params?.messages)
          ? params.messages.slice(-4).map((m: any) => ({
              role: m?.role,
              content: typeof m?.content === 'string' ? m.content.slice(0, 800) : '[structured]',
            }))
          : [],
        toolsCount: Array.isArray(params?.tools) ? params.tools.length : 0,
      },
      output: {
        id: response?.id || null,
        model: resolvedModel,
        usage,
        token_usage: usage,
        finishReason: firstChoice?.finish_reason || null,
        toolCallsCount: toolCallCount,
        choices: firstChoice
          ? [
              {
                index: firstChoice.index ?? 0,
                finish_reason: firstChoice.finish_reason ?? null,
                message: {
                  role: firstChoice.message?.role || 'assistant',
                  content:
                    typeof firstChoice.message?.content === 'string'
                      ? firstChoice.message.content.slice(0, 1200)
                      : null,
                  tool_calls_count: toolCallCount,
                },
              },
            ]
          : [],
      },
      error: null,
      tags: ['openai', ctx.feature, ...(ctx.tags || [])],
      metadata: {
        toolCallsCount: toolCallCount,
        finishReason: firstChoice?.finish_reason || null,
        ...(ctx.metadata || {}),
      },
    });

    return response;
  } catch (err: any) {
    const endedMs = Date.now();
    emitWyresTraceAsync({
      id: runId,
      traceId,
      parentRunId: ctx.parentRunId ?? null,
      name: ctx.name,
      runType: 'llm',
      provider: 'openai',
      model: requestedModel,
      category: ctx.category || 'llm',
      feature: ctx.feature,
      status: 'error',
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      userId: ctx.userId,
      input: {
        model: requestedModel,
        messageCount: Array.isArray(params?.messages) ? params.messages.length : 0,
      },
      output: null,
      error: err?.message || String(err),
      tags: ['openai', 'error', ctx.feature, ...(ctx.tags || [])],
      metadata: {
        httpStatus: err?.status || null,
        errorCode: err?.code || null,
        ...(ctx.metadata || {}),
      },
    });
    throw err;
  }
}

/**
 * Instrumented OpenAI Text-to-Speech (TTS) helper.
 */
export async function tracedOpenAITts(
  openai: OpenAI,
  params: { model: string; voice: any; input: string },
  ctx: {
    name: string;
    feature: string;
    traceId?: string;
    parentRunId?: string | null;
    userId?: string;
    language?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }
): Promise<Buffer> {
  const runId = generateWyresId('wyr_tts');
  const traceId = ctx.traceId || runId;
  const startedMs = Date.now();
  const startTime = new Date(startedMs).toISOString();
  const inputChars = (params.input || '').length;

  try {
    const mp3 = await openai.audio.speech.create(params);
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const endedMs = Date.now();
    const estimatedCost = estimateWyresCost({ model: params.model, inputChars });

    emitWyresTraceAsync({
      id: runId,
      traceId,
      parentRunId: ctx.parentRunId ?? null,
      name: ctx.name,
      runType: 'chain',
      provider: 'openai',
      model: params.model,
      category: 'voice_ai',
      feature: ctx.feature,
      status: 'success',
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost,
      userId: ctx.userId,
      input: {
        voice: params.voice,
        inputChars,
        preview: params.input.slice(0, 200),
      },
      output: {
        audioBytes: buffer.length,
        contentType: 'audio/mpeg',
      },
      error: null,
      tags: ['openai', 'tts', 'voice', ctx.feature, ...(ctx.tags || [])],
      metadata: {
        voiceId: params.voice,
        inputChars,
        audioBytes: buffer.length,
        language: ctx.language || 'en',
        ...(ctx.metadata || {}),
      },
    });

    return buffer;
  } catch (err: any) {
    const endedMs = Date.now();
    emitWyresTraceAsync({
      id: runId,
      traceId,
      parentRunId: ctx.parentRunId ?? null,
      name: ctx.name,
      runType: 'chain',
      provider: 'openai',
      model: params.model,
      category: 'voice_ai',
      feature: ctx.feature,
      status: 'error',
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      estimatedCost: 0,
      userId: ctx.userId,
      input: { voice: params.voice, inputChars },
      output: null,
      error: err?.message || String(err),
      tags: ['openai', 'tts', 'voice', 'error', ctx.feature, ...(ctx.tags || [])],
      metadata: { voiceId: params.voice, inputChars, ...(ctx.metadata || {}) },
    });
    throw err;
  }
}

/**
 * Instrumented OpenAI Whisper Audio Transcription helper.
 */
export async function tracedOpenAIWhisper(
  openai: OpenAI,
  params: { file: File; model: string; language?: string },
  ctx: {
    name: string;
    feature: string;
    traceId?: string;
    parentRunId?: string | null;
    userId?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }
): Promise<{ text: string }> {
  const runId = generateWyresId('wyr_stt');
  const traceId = ctx.traceId || runId;
  const startedMs = Date.now();
  const startTime = new Date(startedMs).toISOString();
  const fileBytes = params.file?.size || 0;
  // Approximate speech duration from compressed webm bytes (~8 KB/s)
  const approxSeconds = Math.max(1, Math.round(fileBytes / 8000));

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: params.file,
      model: params.model,
      ...(params.language ? { language: params.language } : {}),
    });
    const endedMs = Date.now();
    const estimatedCost = estimateWyresCost({
      model: params.model,
      audioDurationSeconds: approxSeconds,
    });

    emitWyresTraceAsync({
      id: runId,
      traceId,
      parentRunId: ctx.parentRunId ?? null,
      name: ctx.name,
      runType: 'chain',
      provider: 'openai',
      model: params.model,
      category: 'voice_ai',
      feature: ctx.feature,
      status: 'success',
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      estimatedCost,
      userId: ctx.userId,
      input: {
        audioBytes: fileBytes,
        mimeType: params.file?.type || 'audio/webm',
        language: params.language || 'auto',
      },
      output: {
        transcriptLength: (transcription.text || '').length,
        transcriptPreview: (transcription.text || '').slice(0, 400),
      },
      error: null,
      tags: ['openai', 'whisper', 'voice', ctx.feature, ...(ctx.tags || [])],
      metadata: {
        audioBytes: fileBytes,
        approxSeconds,
        language: params.language || 'auto',
        ...(ctx.metadata || {}),
      },
    });

    return { text: transcription.text };
  } catch (err: any) {
    const endedMs = Date.now();
    emitWyresTraceAsync({
      id: runId,
      traceId,
      parentRunId: ctx.parentRunId ?? null,
      name: ctx.name,
      runType: 'chain',
      provider: 'openai',
      model: params.model,
      category: 'voice_ai',
      feature: ctx.feature,
      status: 'error',
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      estimatedCost: 0,
      userId: ctx.userId,
      input: { audioBytes: fileBytes, language: params.language || 'auto' },
      output: null,
      error: err?.message || String(err),
      tags: ['openai', 'whisper', 'voice', 'error', ctx.feature, ...(ctx.tags || [])],
      metadata: { audioBytes: fileBytes, ...(ctx.metadata || {}) },
    });
    throw err;
  }
}

