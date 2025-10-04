import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { config } from '@haizel/config';
import { TenantContext } from '@haizel/types';

export interface AuthenticatedRequest {
  tenant: TenantContext;
}

@Injectable()
export class AuthService {
  validate(token?: string): TenantContext {
    if (!token) {
      throw new UnauthorizedException({ message: 'Missing token', code: 'AUTH_REQUIRED' });
    }

    const decoded = jwt.verify(token, config.api.API_JWT_SECRET, {
      issuer: config.api.API_JWT_ISSUER,
      audience: config.api.API_JWT_AUDIENCE,
    }) as jwt.JwtPayload;

    const tenantId = decoded['tenant_id'];
    if (!tenantId) {
      throw new UnauthorizedException({ message: 'Tenant not present', code: 'AUTH_INVALID' });
    }

    return {
      tenantId,
      userId: decoded.sub as string,
      scopes: (decoded['scopes'] as string[]) || [],
    };
  }
}
