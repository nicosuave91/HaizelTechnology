import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService, private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { tenant?: any }>();
    const token = request.headers.authorization?.toString().replace('Bearer ', '');
    const tenant = this.authService.validate(token);
    request.tenant = tenant;
    return true;
  }
}
