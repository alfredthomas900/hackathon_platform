import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ArcjetModule as NestArcjetModule,
  fixedWindow,
  shield,
  tokenBucket,
} from '@arcjet/nest';
import { ArcjetService } from './arcjet.service';

@Global()
@Module({
  imports: [
    NestArcjetModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        key: configService.getOrThrow<string>('ARCJET_KEY'),
        rules: [
          shield({ mode: 'LIVE' }),
          fixedWindow({
            mode: 'LIVE',
            window: '60s',
            max: 100 ,
          }),
          tokenBucket({
            mode: 'LIVE',
            refillRate: 5,
            interval: '1m',
            capacity: 10,
          }),
        ],
      }),
    }),
  ],
  providers: [ArcjetService],
  exports: [ArcjetService, NestArcjetModule],
})
export class ArcjetModule {}
