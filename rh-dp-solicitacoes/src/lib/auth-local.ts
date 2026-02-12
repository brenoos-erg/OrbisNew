import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { timingSafeEqual, createHmac } from 'node:crypto'
import bcrypt from 'bcryptjs'

import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from '@/lib/auth-constants'

type SessionPayload = { sub: string; iat: number; exp: number }

function getAuthSecret() {
  const secret = process.env.JWT_SECRET ?? process.env.AUTH_SECRET
  if (!secret) throw new Error('JWT_SECRET não configurado.')
  return secret
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12)
}

export async function verifyPassword(plain: string, stored: string) {
  return bcrypt.compare(plain, stored)
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

export async function getAuthToken() {
  const cookieStore = await cookies()
  return cookieStore.get(AUTH_COOKIE_NAME)?.value
}

export async function readSessionFromCookies() {
  const token = await getAuthToken()
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