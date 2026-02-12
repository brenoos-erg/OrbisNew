import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto'

import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '@/lib/auth-constants'

type SessionPayload = { sub: string; iat: number; exp: number }

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET não configurado.')
  return secret
}

export async function hashPassword(plain: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export async function verifyPassword(plain: string, stored: string) {
  const [salt, expected] = stored.split(':')
  if (!salt || !expected) return false
  const hash = scryptSync(plain, salt, 64).toString('hex')
  const hashBuf = Buffer.from(hash)
  const expectedBuf = Buffer.from(expected)
  return hashBuf.length === expectedBuf.length && timingSafeEqual(hashBuf, expectedBuf)
}

function signPayload(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

function verifyToken(token: string): SessionPayload | null {
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null
  const expected = createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

export function signSession(userId: string) {
  const now = Math.floor(Date.now() / 1000)
  return signPayload({ sub: userId, iat: now, exp: now + AUTH_MAX_AGE_SECONDS })
}

export function readSessionFromCookies() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  return { userId: payload.sub, issuedAt: payload.iat }
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: AUTH_MAX_AGE_SECONDS })
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
}