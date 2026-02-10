import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole } from '../../../common/enums';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: AppRole[]) => {
  return (target: any, _key?: string, descriptor?: any) => {
    Reflect.defineMetadata(ROLES_KEY, roles, descriptor?.value ?? target);
    return descriptor ?? target;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles) {
      return false;
    }

    // Super admin has access to everything
    if (user.roles.includes(AppRole.SUPER_ADMIN)) {
      return true;
    }

    // Admin has access to admin and below
    if (user.roles.includes(AppRole.ADMIN)) {
      const nonSuperAdminRoles = requiredRoles.filter(
        (r) => r !== AppRole.SUPER_ADMIN,
      );
      if (nonSuperAdminRoles.length > 0) {
        return true;
      }
    }

    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
