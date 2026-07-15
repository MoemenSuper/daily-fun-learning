import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Bindings } from './types'

const encoder = new TextEncoder()

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const length = Math.max(leftBytes.length, rightBytes.length)
  let difference = leftBytes.length ^ rightBytes.length
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return difference === 0
}

export async function authenticatedDeviceId(
  c: Context<{ Bindings: Bindings }>,
): Promise<string | null> {
  const authorization = c.req.header('authorization')
  if (!authorization?.startsWith('Device ')) return null

  const separator = authorization.indexOf(':', 7)
  if (separator === -1) return null
  const deviceId = authorization.slice(7, separator)
  const credential = authorization.slice(separator + 1)
  if (!deviceId || !credential) return null

  const device = await c.env.DB
    .prepare('SELECT credential_hash FROM devices WHERE id = ? AND revoked_at IS NULL')
    .bind(deviceId)
    .first<{ credential_hash: string }>()
  if (!device) return null

  const suppliedHash = await sha256(credential)
  return constantTimeEqual(suppliedHash, device.credential_hash) ? deviceId : null
}

export async function hasBrowserSession(c: Context<{ Bindings: Bindings }>): Promise<boolean> {
  if (c.env.ENVIRONMENT === 'development') return true
  const token = getCookie(c, 'dlg_session')
  if (!token) return false
  const tokenHash = await sha256(token)
  const session = await c.env.DB
    .prepare(
      `SELECT 1 AS valid FROM browser_sessions
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first()
  return session !== null
}
