import path from 'path';

const BASE_DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

export const STORAGE_CONFIG = {
    DATA_DIR: path.join(BASE_DATA_DIR, 'recordings', 'spa'),
    AUDIO_DIR: path.join(BASE_DATA_DIR, 'recordings', 'spa', 'audio'),
    TRANSCRIPT_DIR: path.join(BASE_DATA_DIR, 'recordings', 'spa', 'transcripts'),
};
