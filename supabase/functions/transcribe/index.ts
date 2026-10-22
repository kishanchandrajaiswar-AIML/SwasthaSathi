/**
 * Supabase Edge Function: Whisper Speech-to-Text Transcription
 * Securely calls Groq Whisper API for multilingual audio transcription.
 */
import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { audio_base64, language = 'hi' } = await req.json();

    if (!audio_base64 || typeof audio_base64 !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Audio data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GROQ_API_KEY not configured on edge functions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine extension and clean base64 data
    let cleanB64 = audio_base64;
    let mimeType = 'audio/webm';
    let filename = 'audio.webm';

    if (cleanB64.includes(';base64,')) {
      const parts = cleanB64.split(';base64,');
      mimeType = parts[0].replace('data:', '');
      cleanB64 = parts[1];
      if (mimeType.includes('wav')) filename = 'audio.wav';
      else if (mimeType.includes('mp4') || mimeType.includes('m4a')) filename = 'audio.m4a';
      else if (mimeType.includes('ogg')) filename = 'audio.ogg';
      else if (mimeType.includes('mp3')) filename = 'audio.mp3';
    }

    // Convert base64 to binary Uint8Array
    const binaryStr = atob(cleanB64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Build FormData for Groq Audio API
    const formData = new FormData();
    const audioBlob = new Blob([bytes], { type: mimeType });
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', language);
    formData.append('response_format', 'json');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: formData,
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error('Groq Whisper API Error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: `Groq Whisper API error: ${groqResponse.statusText}` }),
        { status: groqResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await groqResponse.json();
    return new Response(
      JSON.stringify({
        success: true,
        transcript: result.text || '',
        language: language,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Transcribe Function Exception:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Error processing audio transcription' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
