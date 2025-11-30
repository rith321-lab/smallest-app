import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DATA_DIR = path.join(process.cwd(), 'data', 'recordings', 'spa');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const TRANSCRIPT_DIR = path.join(DATA_DIR, 'transcripts');
const TEMP_DIR = path.join(process.cwd(), 'data', 'temp');

// Generate unique conversation ID
function generateConversationId(): string {
    return `conv_${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        // Extract metadata
        const speakerOrder = JSON.parse(formData.get('speakerOrder') as string || '[]');
        const userName = formData.get('userName') as string || 'User1';
        const partnerName = formData.get('partnerName') as string || 'User2';
        const userIsSpeakerA = formData.get('userIsSpeakerA') === 'true';
        const turnCount = parseInt(formData.get('turnCount') as string || '0');
        const transcript = formData.get('transcript') as string || '';
        
        // Extract new TTS metadata fields
        const userAge = formData.get('userAge') as string || '';
        const userGender = formData.get('userGender') as string || '';
        const userDialect = formData.get('userDialect') as string || '';
        const userRecordingDevice = formData.get('userRecordingDevice') as string || '';
        const userNationality = formData.get('userNationality') as string || '';

        if (turnCount === 0) {
            return NextResponse.json(
                { error: 'No recordings provided' },
                { status: 400 }
            );
        }

        // Ensure directories exist
        await fs.mkdir(AUDIO_DIR, { recursive: true });
        await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });
        await fs.mkdir(TEMP_DIR, { recursive: true });

        const conversationId = generateConversationId();
        const tempFiles: string[] = [];

        try {
            // Save all blobs as temporary WebM files
            for (let i = 0; i < turnCount; i++) {
                const blob = formData.get(`recording_${i}`) as Blob;
                if (!blob) continue;

                const tempPath = path.join(TEMP_DIR, `${conversationId}_turn_${i}.webm`);
                const buffer = Buffer.from(await blob.arrayBuffer());
                await fs.writeFile(tempPath, buffer);
                tempFiles.push(tempPath);
            }

            if (tempFiles.length === 0) {
                throw new Error('No valid recordings found');
            }

            // Create concat file list for FFmpeg
            const concatListPath = path.join(TEMP_DIR, `${conversationId}_concat.txt`);
            const concatContent = tempFiles.map(f => `file '${f}'`).join('\n');
            await fs.writeFile(concatListPath, concatContent);

            // Concatenate and convert to WAV using FFmpeg
            const outputWavPath = path.join(AUDIO_DIR, `spa_${conversationId}.wav`);
            const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -ar 24000 -ac 1 -sample_fmt s16 "${outputWavPath}"`;

            await execAsync(ffmpegCommand);

            // Save transcript
            const transcriptPath = path.join(TRANSCRIPT_DIR, `spa_${conversationId}.txt`);
            await fs.writeFile(transcriptPath, transcript, 'utf-8');

            // Save metadata JSON
            const metadataPath = path.join(DATA_DIR, `spa_${conversationId}_metadata.json`);
            const durationSec = turnCount * 30; // Each turn is 30 seconds
            const metadata = {
                conversationId,
                speakerOrder,
                speakers: {
                    A: userIsSpeakerA ? userName : partnerName,
                    B: userIsSpeakerA ? partnerName : userName
                },
                turnCount,
                recordedAt: new Date().toISOString(),
                transcript,
                // TTS metadata fields
                age: userAge,
                gender: userGender,
                dialect: userDialect,
                recordingDevice: userRecordingDevice,
                nationality: userNationality,
                language: 'Spanish',
                durationSec
            };
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

            // Update metadata.csv with new entry
            const csvPath = path.join(DATA_DIR, 'metadata.csv');
            const csvHeader = 'file_name,speaker_id,age,gender,language,dialect,duration_sec,recording_device,notes\n';
            const csvRow = `spa_${conversationId}.wav,${conversationId},${userAge},${userGender},Spanish,${userDialect},${durationSec},${userRecordingDevice},"${userName} conversation"\n`;
            
            try {
                await fs.access(csvPath);
                // File exists, append row
                await fs.appendFile(csvPath, csvRow);
            } catch {
                // File doesn't exist, create with header
                await fs.writeFile(csvPath, csvHeader + csvRow);
            }

            // Cleanup temp files
            await Promise.all([
                ...tempFiles.map(f => fs.unlink(f).catch(() => { })),
                fs.unlink(concatListPath).catch(() => { })
            ]);

            return NextResponse.json({
                success: true,
                conversationId,
                audioFile: `spa_${conversationId}.wav`,
                transcriptFile: `spa_${conversationId}.txt`,
                turnCount
            });

        } catch (error) {
            // Cleanup on error
            await Promise.all(
                tempFiles.map(f => fs.unlink(f).catch(() => { }))
            );
            throw error;
        }

    } catch (error: any) {
        console.error('Save conversation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to save conversation' },
            { status: 500 }
        );
    }
}
