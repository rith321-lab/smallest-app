const fs = require('fs');
const path = require('path');

async function testEndpoints() {
    const baseUrl = 'http://localhost:3000';
    const speakerId = '9999';
    const sampleId = '001';

    console.log('--- Testing TTS Export System ---');

    // 1. Test Save Recording
    console.log('\n1. Testing /api/save-recording...');
    const audioPath = path.join(__dirname, 'test_audio.webm');
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });

    const formData = new FormData();
    formData.append('audio', audioBlob, 'test_audio.webm');
    formData.append('speakerId', speakerId);
    formData.append('sampleId', sampleId);

    try {
        const res = await fetch(`${baseUrl}/api/save-recording`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        console.log('Response:', data);
        if (data.success) console.log('✅ Save Recording PASSED');
        else console.error('❌ Save Recording FAILED');
    } catch (e) {
        console.error('❌ Save Recording ERROR:', e.message);
    }

    // 2. Test Save Transcript
    console.log('\n2. Testing /api/save-transcript...');
    try {
        const res = await fetch(`${baseUrl}/api/save-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                speakerId,
                sampleId,
                transcript: 'Hola, esto es una prueba de audio.',
                soundEvents: ['Laugh']
            })
        });
        const data = await res.json();
        console.log('Response:', data);
        if (data.success) console.log('✅ Save Transcript PASSED');
        else console.error('❌ Save Transcript FAILED');
    } catch (e) {
        console.error('❌ Save Transcript ERROR:', e.message);
    }

    // 3. Test Export Dataset
    console.log('\n3. Testing /api/export-dataset...');
    try {
        const res = await fetch(`${baseUrl}/api/export-dataset`);
        if (res.ok) {
            const buffer = await res.arrayBuffer();
            fs.writeFileSync('test_dataset.zip', Buffer.from(buffer));
            console.log('✅ Export Dataset PASSED (saved to test_dataset.zip)');
            console.log(`Zip size: ${buffer.byteLength} bytes`);
        } else {
            console.error('❌ Export Dataset FAILED:', res.status, res.statusText);
        }
    } catch (e) {
        console.error('❌ Export Dataset ERROR:', e.message);
    }
}

testEndpoints();
