import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, AI_CONFIG } from '@/lib/openai/config';
import { buildContextualPrompt } from '@/lib/agents/prompts';
import { AGENT_TOOLS_DEFINITIONS } from '@/lib/agents/tool-definitions';
import { LocalRAGEngine } from '@/lib/ai/LocalRAGEngine';

export async function POST(req: NextRequest) {
  let latestUserMessage = '';
  let contextPayload: any = null;

  try {
    const { messages, context } = await req.json();
    contextPayload = context;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    latestUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    // Check if OPENAI_API_KEY is configured
    const apiKey = (process.env.OPENAI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
    const hasValidApiKey = apiKey && !apiKey.startsWith('dummy') && apiKey.length > 20;

    if (!hasValidApiKey) {
      // Direct Local RAG execution (instant, zero cost, 100% offline capable)
      const localResult = LocalRAGEngine.processQuery(latestUserMessage, context);
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

    const response = await openai.chat.completions.create(completionParams);

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

          const { result, recommendations, memoryUpdates } = await executeAgentTool(
            toolName,
            toolArgs,
            context?.userId
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
      try {
        const followUpParams: any = {
          model,
          messages: followUpMessages,
          max_completion_tokens: AI_CONFIG.maxTokens,
        };
        if (isGpt5) {
          followUpParams.reasoning_effort = 'none';
        }

        const followUpResponse = await openai.chat.completions.create(followUpParams);
        followUpContent = followUpResponse.choices?.[0]?.message?.content || '';
      } catch (err: any) {
        console.warn('Error during AI follow-up synthesis:', err?.message || err);
      }

      return NextResponse.json(
        {
          content:
            followUpContent ||
            'Here are the matching selections from the Return of the Break Beats catalog:',
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
      const localResult = LocalRAGEngine.processQuery(latestUserMessage, contextPayload);
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
      return NextResponse.json(
        {
          content:
            'Yo! Break Beats AI is active. You can stream tracks from /music, watch documentaries in /videos, or explore vinyl in /merch!',
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
