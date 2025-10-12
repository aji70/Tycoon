import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { AppHealthService } from '../services/health.service';

@Controller('health')
export class HealthController {
  constructor(private healthService: AppHealthService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.healthService.check();
  }

  @Get('liveness')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  readiness() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}