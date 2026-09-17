import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export function jwtAccessOptions(configService: ConfigService): JwtModuleOptions {
  return {
    secret: configService.get<string>('JWT_ACCESS_SECRET'),
    signOptions: {
      expiresIn: configService.get<string>('ACCESS_TOKEN_TTL', '15m'),
    },
  };
}

export function jwtRefreshOptions(configService: ConfigService): JwtModuleOptions {
  const ttlDays = configService.get<number>('REFRESH_TOKEN_TTL_DAYS', 7);
  return {
    secret: configService.get<string>('JWT_REFRESH_SECRET'),
    signOptions: {
      expiresIn: `${ttlDays}d`,
    },
  };
}
