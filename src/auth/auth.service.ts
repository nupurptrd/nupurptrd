import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(userId: string, workspaceId: string) {
    const payload = { userId, workspaceId };
    return this.jwtService.sign(payload);
  }
}
