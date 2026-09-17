import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// v2: calls the Gemini API directly (GEMINI_API_KEY secret). v1 went through
// the Lovable AI gateway, which this project no longer uses; the model
// (gemini-2.5-flash) is unchanged. User-facing errors stay generic — provider
// details are logged server-side only.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// Defensive cap: a 25 MB audio file is comfortably more than an hour of
// compressed voice memo; well below model input limits but bounds what any
// authenticated user can push at the LLM in one call.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["audio/"];

const GEMINI_MODEL = "gemini-2.5-flash";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("transcribe-audio: GEMINI_API_KEY secret is not set");
      return new Response(
        JSON.stringify({ error: "Voice transcription isn't configured yet." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return new Response(JSON.stringify({ error: `Audio file exceeds ${MAX_AUDIO_BYTES / 1024 / 1024} MB` }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mimeType = audioFile.type || "audio/webm";
    if (!ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
      return new Response(JSON.stringify({ error: `Unsupported MIME type: ${mimeType}` }), {
        status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));

    // MediaRecorder emits e.g. "audio/webm;codecs=opus" — Gemini wants the bare type.
    const bareMime = mimeType.split(";")[0].trim();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Transcribe this audio recording accurately. Return ONLY the transcription text, nothing else. If the audio is unclear, do your best to transcribe what you can hear.",
                },
                { inline_data: { mime_type: bareMime, data: base64 } },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("transcribe-audio provider error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Transcription is busy right now. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Transcription failed. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const transcript: string = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();

    if (!transcript) {
      console.error("transcribe-audio: empty transcript in provider response", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Could not hear anything in that recording. Please try again." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-audio error:", e);
    return new Response(JSON.stringify({ error: "Transcription failed. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
