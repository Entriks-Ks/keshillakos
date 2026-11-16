import { AccessToken } from 'livekit-server-sdk'
import dotenv from 'dotenv'

export function getLivekitConfig() {
  // If process.env still holds the old placeholder cloud URL or dummy secret, reload from .env with override
  if (
    process.env.LIVEKIT_URL === 'wss://keshillakos.livekit.cloud' ||
    process.env.LIVEKIT_API_SECRET === 'secret_must_be_at_least_32_characters_long'
  ) {
    dotenv.config({ override: true })
  }

  const url = process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST || 'ws://127.0.0.1:7880'
  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey'
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret'

  return {
    url,
    apiKey,
    apiSecret,
    isConfigured: Boolean(url && apiKey && apiSecret),
  }
}

export type GenerateTokenOptions = {
  roomName: string
  identity: string
  name?: string
  ttl?: string | number
}

export async function generateLivekitToken({
  roomName,
  identity,
  name,
  ttl = '2h',
}: GenerateTokenOptions): Promise<string> {
  const { apiKey, apiSecret } = getLivekitConfig()

  if (!apiKey || !apiSecret) {
    throw new Error('Konfigurimi i LiveKit mungon (LIVEKIT_API_KEY / LIVEKIT_API_SECRET)')
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || identity,
    ttl: typeof ttl === 'string' ? ttl : `${ttl}s`,
  })

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  return at.toJwt()
}
