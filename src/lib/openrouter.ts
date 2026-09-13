export const TTS_MODEL =
  (import.meta.env.VITE_TTS_MODEL as string) || 'fish-audio/s2.1-pro-free:free'
export const DEFAULT_VOICE =
  (import.meta.env.VITE_DEFAULT_VOICE_ID as string) || 'b2cf0387ecb446d78a77d23284413f51'
export const FISH_DIRECT = `https://fish.audio/en/model/${DEFAULT_VOICE}`
export const PLAYGROUND = `https://openrouter.ai/${TTS_MODEL}#playground`

export type TtsError = { status: number; message: string; isFishDown: boolean }

export async function generateSpeech(opts: {
  apiKey: string
  text: string
  voice: string
  signal?: AbortSignal
}): Promise<Blob> {
  const res = await fetch('https://openrouter.ai/api/v1/audio/speech', {
    method: 'POST',
    signal: opts.signal,
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.href,
      'X-Title': 'VoiceStudio-React',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: opts.text,
      response_format: 'mp3',
      voice: opts.voice,
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const isFishDown = res.status === 503 || txt.includes('CLERK_OAUTH_ISSUER')
    throw {
      status: res.status,
      message: isFishDown
        ? 'OpenRouter Fish model is down (503). Use Fish Direct fallback — no key needed.'
        : `API ${res.status}: ${txt.slice(0, 300)}`,
      isFishDown,
    } as TtsError
  }
  return await res.blob()
}

export function curlSnippet(apiKeyMasked: string, text: string, voice: string): string {
  const short = text.replace(/"/g, "'").slice(0, 200)
  return `curl https://openrouter.ai/api/v1/audio/speech \\\n  -H "Authorization: Bearer ${apiKeyMasked}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${TTS_MODEL}","input":"${short}...","voice":"${voice}"}' --output voice.mp3`
}
