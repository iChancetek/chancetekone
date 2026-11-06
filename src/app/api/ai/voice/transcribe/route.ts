import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, AI_CONFIG } from '@/lib/openai/config';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob | null;
    const requestedLanguage = (formData.get('language') as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const openai = getOpenAIClient();

    // Convert Blob to File object suitable for OpenAI SDK
    const audioFile = new File([file], 'audio.webm', { type: file.type || 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: AI_CONFIG.whisperModel,
      ...(requestedLanguage ? { language: requestedLanguage } : {}),
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error('Whisper transcription error:', error);
    return NextResponse.json({ error: error.message || 'Transcription failed' }, { status: 500 });
  }
}
