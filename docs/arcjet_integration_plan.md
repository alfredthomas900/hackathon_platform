# Arcjet Integration Plan

This document outlines the step-by-step plan and actual implementation for integrating Arcjet security checks (Shield, Bot Detection, Rate Limiting) into our NestJS 11 application.

## 1. Retrieved Configuration (from Arcjet MCP)

Through the Arcjet MCP, we created the following site:
- **Default Team:** `Personal (team_01kw81396sfdvtv4ejhwt83k4v)`
- **Site Name:** `hackathon-platform`
- **Site ID:** `site_01kw8237fge1erw52xt3288d2n`
- **SDK Key:** `ajkey_01kw8237fhe1etmt62vqnpgnty`

This key is stored in the `.env` file as:
```env
ARCJET_KEY=ajkey_01kw8237fhe1etmt62vqnpgnty
```

---

## 2. Installation

Install the official NestJS SDK package and Config package:

```bash
npm install @arcjet/nest @nestjs/config
```

---

## 3. Architecture Design (NestJS Standards)

According to the project guidelines, every infrastructure integration must get its own module and service, marked as `@Global()` and imported once in `AppModule`.

```mermaid
graph TD
    AppModule -->|Imports once| ArcjetModule[src/lib/arcjet/arcjet.module.ts]
    ArcjetModule -->|Declares & Exports| ArcjetService[src/lib/arcjet/arcjet.service.ts]
    ArcjetService -->|Wraps| ArcjetSDK[@arcjet/nest]
    AppController -->|Protected by| ArcjetGuard[ArcjetGuard]
```

### Implemented Files

#### `src/lib/arcjet/arcjet.module.ts`
This module configures the global Arcjet instance and exports the service. We use `forRootAsync` to load `ARCJET_KEY` via `ConfigService`.

```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArcjetModule as NestArcjetModule, shield, tokenBucket } from '@arcjet/nest';
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
```

#### `src/lib/arcjet/arcjet.service.ts`
A service wrapping any manual evaluation logic, injecting the NestJS Arcjet client using standard dependency injection tokens.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ARCJET } from '@arcjet/nest';
import type { ArcjetNest } from '@arcjet/nest';

@Injectable()
export class ArcjetService {
  constructor(@Inject(ARCJET) private readonly arcjet: ArcjetNest) {}

  /**
   * Run custom protection logic on an incoming request object
   */
  async protect(request: any) {
    return this.arcjet.protect(request);
  }
}
```

---

## 4. Protecting Routes Globally

We register `ArcjetGuard` globally using `APP_GUARD` inside `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ArcjetGuard } from '@arcjet/nest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArcjetModule } from './lib/arcjet/arcjet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ArcjetModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ArcjetGuard,
    },
  ],
})
export class AppModule {}
```

---

## 5. Jest Configuration (ESM Support)

Since `@arcjet/nest` and `arcjet` are ESM-only packages, the default Jest configuration requires updating `transformIgnorePatterns` in `package.json` to process them:

```json
{
  "jest": {
    "transformIgnorePatterns": [
      "node_modules/(?!(@arcjet|arcjet)/)"
    ]
  }
}
```
