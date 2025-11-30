import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
    try {
        // Check for API key before proceeding
        if (!process.env.OPENAI_API_KEY) {
            console.error('Missing OPENAI_API_KEY environment variable');
            return NextResponse.json(
                { error: 'Auto-transcription not configured. Please set OPENAI_API_KEY in your environment.' },
                { status: 500 }
            );
        }

        // Initialize OpenAI client only when the endpoint is called, not during build
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        // Convert File to format OpenAI expects
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: 'es', // Spanish
            response_format: 'text',
        });

        return NextResponse.json({ text: transcription });
    } catch (error: any) {
        console.error('Transcription error:', error);
        return NextResponse.json(
            { error: error.message || 'Transcription failed' },
            { status: 500 }
        );
    }
}
