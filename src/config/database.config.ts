import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    autoLoadEntities: true,
    logging: configService.get<string>('NODE_ENV') !== 'production',
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  }),
};
