import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { STORAGE_CONFIG } from '@/app/lib/storage-config';

const { AUDIO_DIR } = STORAGE_CONFIG;

async function ensureDirectories() {
    await fs.mkdir(AUDIO_DIR, { recursive: true });
}

// Convert WebM blob to WAV with 24kHz PCM 16-bit
async function convertToWav(buffer: Buffer, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const inputStream = Readable.from(buffer);

        ffmpeg(inputStream)
            .inputFormat('webm')
            .audioCodec('pcm_s16le') // PCM 16-bit
            .audioFrequency(24000)   // 24kHz
            .audioChannels(1)         // Mono
            .format('wav')
            .save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });
}

export async function POST(request: NextRequest) {
    try {
        await ensureDirectories();

        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;
        const speakerId = formData.get('speakerId') as string;
        const sampleId = formData.get('sampleId') as string;

        if (!audioFile || !speakerId || !sampleId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Generate filename: spa_0001_001.wav
        const filename = `spa_${speakerId.padStart(4, '0')}_${sampleId.padStart(3, '0')}.wav`;
        const outputPath = path.join(AUDIO_DIR, filename);

        // Convert webm to wav
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await convertToWav(buffer, outputPath);

        return NextResponse.json({
            success: true,
            filename,
            path: outputPath
        });
    } catch (error: any) {
        console.error('Audio save error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to save audio' },
            { status: 500 }
        );
    }
}
