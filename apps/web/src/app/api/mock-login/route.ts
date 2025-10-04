import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { nanoid } from 'nanoid';

const secret = new TextEncoder().encode(process.env.API_JWT_SECRET || 'dev-secret-please-change');

export async function GET() {
  const tenantId = 'tenant-alpha';
  const userId = `user-${nanoid(6)}`;
  const jwt = await new SignJWT({
    sub: userId,
    tenant_id: tenantId,
    scopes: ['loans:read'],
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(process.env.API_JWT_ISSUER || 'https://auth.dev.haizel.local')
    .setAudience(process.env.API_JWT_AUDIENCE || 'haizel-broker')
    .setExpirationTime('1h')
    .sign(secret);

  return NextResponse.json({ token: jwt, tenantId });
}
