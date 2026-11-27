import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, AI_CONFIG } from '@/lib/openai/config';
import { buildContextualPrompt } from '@/lib/agents/prompts';
import { AGENT_TOOLS_DEFINITIONS } from '@/lib/agents/tool-definitions';
import { LocalRAGEngine } from '@/lib/ai/LocalRAGEngine';
import {
  emitWyresTraceAsync,
  generateWyresId,
  tracedOpenAIChatCompletion,
  traceWyresExecution,
} from '@/lib/telemetry/wyres';

export async function POST(req: NextRequest) {
  let latestUserMessage = '';
  let contextPayload: any = null;
  const agentRunId = generateWyresId('wyr_agent');
  const traceId = agentRunId;
  const agentStartedMs = Date.now();
  const agentStartTime = new Date(agentStartedMs).toISOString();

  try {
    const { messages, context } = await req.json();
    contextPayload = context;
    const userId = context?.userId || undefined;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    latestUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    // Check if OPENAI_API_KEY is configured
    const apiKey = (process.env.OPENAI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
    const hasValidApiKey = apiKey && !apiKey.startsWith('dummy') && apiKey.length > 20;

    if (!hasValidApiKey) {
      // Direct Local RAG execution (instant, zero cost, 100% offline capable)
      const ragStart = Date.now();
      const localResult = LocalRAGEngine.processQuery(latestUserMessage, context);
      const ragEnd = Date.now();

      emitWyresTraceAsync({
        traceId,
        parentRunId: agentRunId,
        name: 'breakbeats-assistant:local-rag',
        runType: 'retriever',
        provider: 'chancetek-rag',
        model: 'local-rag-v1',
        category: 'rag_retriever',
        feature: 'breakbeats-assistant',
        startTime: new Date(ragStart).toISOString(),
        endTime: new Date(ragEnd).toISOString(),
        latencyMs: ragEnd - ragStart,
        userId,
        input: { query: latestUserMessage, currentPage: context?.currentPage || null },
        output: {
          contentPreview: (localResult.content || '').slice(0, 600),
          toolCallsCount: localResult.toolCalls?.length || 0,
        },
        tags: ['ai-assistant', 'local-rag', 'rag'],
      });

      emitWyresTraceAsync({
        id: agentRunId,
        traceId,
        parentRunId: null,
        name: 'breakbeats-assistant:agent',
        runType: 'agent',
        provider: 'chancetek-rag',
        model: 'local-rag-v1',
        category: 'ai_assistant',
        feature: 'breakbeats-assistant',
        startTime: agentStartTime,
        endTime: new Date(ragEnd).toISOString(),
        latencyMs: ragEnd - agentStartedMs,
        userId,
        input: { query: latestUserMessage, messageCount: messages.length, currentPage: context?.currentPage || null },
        output: {
          mode: 'local-rag',
          toolCallsCount: localResult.toolCalls?.length || 0,
          contentPreview: (localResult.content || '').slice(0, 600),
        },
        tags: ['ai-assistant', 'copilot', 'local-rag'],
        metadata: { executionMode: 'local-rag', currentPage: context?.currentPage || null },
      });

      return NextResponse.json(
        {
          content: localResult.content,
          toolCalls: localResult.toolCalls,
          recommendations: localResult.recommendations,
          memoryUpdates: localResult.memoryUpdates,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const openai = getOpenAIClient();
    const systemPrompt = buildContextualPrompt(context);

    const formattedMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role,
        content: m.content || '',
      })),
    ];

    const model = AI_CONFIG.defaultModel;
    const isGpt5 = model.toLowerCase().startsWith('gpt-5');

    const completionParams: any = {
      model,
      messages: formattedMessages,
      tools: AGENT_TOOLS_DEFINITIONS,
      tool_choice: 'auto',
      max_completion_tokens: AI_CONFIG.maxTokens,
    };

    if (isGpt5) {
      completionParams.reasoning_effort = 'none';
    }

    const response = await tracedOpenAIChatCompletion(openai, completionParams, {
      name: 'breakbeats-assistant:chat.completions',
      feature: 'breakbeats-assistant',
      category: 'ai_assistant',
      traceId,
      parentRunId: agentRunId,
      userId,
      tags: ['ai-assistant', 'copilot', 'chat'],
      metadata: { currentPage: context?.currentPage || null },
    });

    const choice = response.choices[0];
    const message = choice?.message;

    if (!message) {
      throw new Error('No message returned from model');
    }

    // Check if tools were invoked
    if (message.tool_calls && message.tool_calls.length > 0) {
      const { executeAgentTool } = await import('@/lib/agents/tools');

      const executedToolCalls: any[] = [];
      const toolResponseMessages: any[] = [];
      const mergedRecommendations: any = {
        tracks: [],
        videos: [],
        audiobooks: [],
        products: [],
        projects: [],
        producers: [],
      };
      const mergedMemoryUpdates: any = { newFacts: [], updatedTaste: null };

      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, any> = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {}

          const { result, recommendations, memoryUpdates } = await traceWyresExecution(
            {
              traceId,
              parentRunId: agentRunId,
              name: `tool.${toolName}`,
              runType: 'tool',
              provider: 'chancetek-tool',
              model: `tool.${toolName}`,
              category: 'agentic_agent',
              feature: 'breakbeats-assistant',
              userId,
              input: toolArgs,
              tags: ['tool', toolName, 'ai-assistant'],
              metadata: { toolName },
              extractOutput: (res) => ({
                hasRecommendations: Boolean(res?.recommendations),
                hasMemoryUpdates: Boolean(res?.memoryUpdates),
                count: typeof res?.result?.count === 'number' ? res.result.count : undefined,
              }),
            },
            () => executeAgentTool(toolName, toolArgs, context?.userId)
          );

          executedToolCalls.push({
            toolName,
            args: toolArgs,
            status: 'completed',
            result,
          });

          if (recommendations) {
            if (recommendations.tracks) mergedRecommendations.tracks.push(...recommendations.tracks);
            if (recommendations.videos) mergedRecommendations.videos.push(...recommendations.videos);
            if (recommendations.audiobooks) mergedRecommendations.audiobooks.push(...recommendations.audiobooks);
            if (recommendations.products) mergedRecommendations.products.push(...recommendations.products);
            if (recommendations.projects) mergedRecommendations.projects.push(...recommendations.projects);
            if (recommendations.producers) mergedRecommendations.producers.push(...recommendations.producers);
          }

          if (memoryUpdates) {
            if (memoryUpdates.newFacts) mergedMemoryUpdates.newFacts.push(...memoryUpdates.newFacts);
            if (memoryUpdates.updatedTaste) mergedMemoryUpdates.updatedTaste = memoryUpdates.updatedTaste;
          }

          toolResponseMessages.push({
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify(result || { status: 'ok' }),
          });
        }
      }

      // Feed ALL tool results back to model for final synthesis
      const followUpMessages = [
        ...formattedMessages,
        message,
        ...toolResponseMessages,
      ];

      let followUpContent = '';
      let followUpUsage: any = null;
      try {
        const followUpParams: any = {
          model,
          messages: followUpMessages,
          max_completion_tokens: AI_CONFIG.maxTokens,
        };
        if (isGpt5) {
          followUpParams.reasoning_effort = 'none';
        }

        const followUpResponse = await tracedOpenAIChatCompletion(openai, followUpParams, {
          name: 'breakbeats-assistant:synthesis',
          feature: 'breakbeats-assistant',
          category: 'ai_assistant',
          traceId,
          parentRunId: agentRunId,
          userId,
          tags: ['ai-assistant', 'tool-synthesis'],
          metadata: { executedTools: executedToolCalls.map((t) => t.toolName) },
        });
        followUpContent = followUpResponse.choices?.[0]?.message?.content || '';
        followUpUsage = followUpResponse.usage || null;
      } catch (err: any) {
        console.warn('Error during AI follow-up synthesis:', err?.message || err);
      }

      const endedMs = Date.now();
      const totalPromptTokens =
        Number(response?.usage?.prompt_tokens || 0) + Number(followUpUsage?.prompt_tokens || 0);
      const totalCompletionTokens =
        Number(response?.usage?.completion_tokens || 0) + Number(followUpUsage?.completion_tokens || 0);

      emitWyresTraceAsync({
        id: agentRunId,
        traceId,
        parentRunId: null,
        name: 'breakbeats-assistant:agent',
        runType: 'agent',
        provider: 'openai',
        model: response?.model || model,
        category: 'ai_assistant',
        feature: 'breakbeats-assistant',
        startTime: agentStartTime,
        endTime: new Date(endedMs).toISOString(),
        latencyMs: endedMs - agentStartedMs,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        userId,
        input: { query: latestUserMessage, messageCount: messages.length },
        output: {
          mode: 'openai-agent-tools',
          toolsExecuted: executedToolCalls.map((t) => t.toolName),
          contentPreview: (followUpContent || '').slice(0, 600),
        },
        tags: ['ai-assistant', 'agentic-tools', 'copilot'],
        metadata: {
          executionMode: 'openai-tools',
          toolCallsCount: executedToolCalls.length,
          currentPage: context?.currentPage || null,
        },
      });

      return NextResponse.json(
        {
          content:
            followUpContent ||
            'Here are the matching selections from the ChanceTEK One catalog:',
          toolCalls: executedToolCalls,
          recommendations: mergedRecommendations,
          memoryUpdates: mergedMemoryUpdates,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const endedMs = Date.now();
    emitWyresTraceAsync({
      id: agentRunId,
      traceId,
      parentRunId: null,
      name: 'breakbeats-assistant:agent',
      runType: 'agent',
      provider: 'openai',
      model: response?.model || model,
      category: 'ai_assistant',
      feature: 'breakbeats-assistant',
      startTime: agentStartTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - agentStartedMs,
      promptTokens: Number(response?.usage?.prompt_tokens || 0),
      completionTokens: Number(response?.usage?.completion_tokens || 0),
      totalTokens: Number(response?.usage?.total_tokens || 0),
      userId,
      input: { query: latestUserMessage, messageCount: messages.length },
      output: {
        mode: 'openai-direct',
        contentPreview: (message.content || '').slice(0, 600),
      },
      tags: ['ai-assistant', 'copilot'],
      metadata: { executionMode: 'openai-direct', currentPage: context?.currentPage || null },
    });

    return NextResponse.json(
      {
        content: message.content || '',
        toolCalls: [],
        recommendations: {},
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.warn(
      '[AI Chat] External OpenAI API unavailable or credit balance exhausted (status:',
      error?.status,
      error?.code,
      ') — Switching seamlessly to Autonomous Local RAG Engine'
    );

    // Seamless Autonomous Local RAG execution
    try {
      const ragStart = Date.now();
      const localResult = LocalRAGEngine.processQuery(latestUserMessage, contextPayload);
      const ragEnd = Date.now();

      emitWyresTraceAsync({
        id: agentRunId,
        traceId,
        parentRunId: null,
        name: 'breakbeats-assistant:agent',
        runType: 'agent',
        provider: 'chancetek-rag',
        model: 'local-rag-v1',
        category: 'ai_assistant',
        feature: 'breakbeats-assistant',
        startTime: agentStartTime,
        endTime: new Date(ragEnd).toISOString(),
        latencyMs: ragEnd - agentStartedMs,
        userId: contextPayload?.userId || undefined,
        input: { query: latestUserMessage },
        output: {
          mode: 'local-rag-fallback',
          toolCallsCount: localResult.toolCalls?.length || 0,
          contentPreview: (localResult.content || '').slice(0, 600),
        },
        tags: ['ai-assistant', 'local-rag', 'fallback'],
        metadata: {
          isFallback: true,
          fallbackReason: error?.message || String(error),
          ragLatencyMs: ragEnd - ragStart,
        },
      });

      return NextResponse.json(
        {
          content: localResult.content,
          toolCalls: localResult.toolCalls,
          recommendations: localResult.recommendations,
          memoryUpdates: localResult.memoryUpdates,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    } catch (localErr: any) {
      console.error('[AI Chat] Local RAG processing error:', localErr);
      const endedMs = Date.now();
      emitWyresTraceAsync({
        id: agentRunId,
        traceId,
        parentRunId: null,
        name: 'breakbeats-assistant:agent',
        runType: 'agent',
        provider: 'chancetek-rag',
        model: 'local-rag-v1',
        category: 'ai_assistant',
        feature: 'breakbeats-assistant',
        status: 'error',
        startTime: agentStartTime,
        endTime: new Date(endedMs).toISOString(),
        latencyMs: endedMs - agentStartedMs,
        userId: contextPayload?.userId || undefined,
        input: { query: latestUserMessage },
        error: localErr?.message || String(localErr),
        tags: ['ai-assistant', 'error'],
      });

      return NextResponse.json(
        {
          content:
            'Yo! ChanceTEK One AI is active. You can stream tracks from /music, watch documentaries in /videos, or explore vinyl in /merch!',
          toolCalls: [],
          recommendations: {},
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }
  }
}
