// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs Text-to-Speech utility — Yara Voice
//
// textToSpeechElevenLabs(text, language) → Buffer (MP3 audio)
//
// Used to generate Yara's voice replies when a customer sends a voice note
// on Instagram and we want to reply with a voice note too.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "./logger";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

/**
 * Convert text to speech using ElevenLabs API.
 * Returns an MP3 buffer, or null on any error (graceful degradation).
 *
 * @param text     The text to speak (Arabic or English)
 * @param language 'ar' | 'en' — selects the appropriate voice
 */
export async function textToSpeechElevenLabs(
  text: string,
  language: "ar" | "en" = "ar",
): Promise<Buffer | null> {
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) {
    logger.warn("tts: ELEVENLABS_API_KEY not set — skipping TTS");
    return null;
  }

  // Select voice based on language
  const voiceId =
    language === "ar"
      ? (process.env["ELEVENLABS_ARABIC_VOICE_ID"] ?? "")
      : (process.env["ELEVENLABS_ENGLISH_VOICE_ID"] ?? "");

  if (!voiceId) {
    logger.warn(
      { language },
      "tts: voice ID not configured (ELEVENLABS_ARABIC_VOICE_ID / ELEVENLABS_ENGLISH_VOICE_ID)",
    );
    return null;
  }

  const trimmedText = text.slice(0, 5000); // ElevenLabs limit

  try {
    const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: trimmedText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "(no body)");
      logger.warn(
        { status: res.status, body: errBody.slice(0, 200) },
        "tts: ElevenLabs API error",
      );
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info(
      { bytes: buffer.length, language, chars: trimmedText.length },
      "tts: ElevenLabs audio generated",
    );

    return buffer;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "tts: ElevenLabs TTS request failed",
    );
    return null;
  }
}
