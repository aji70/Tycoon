import { Injectable } from '@nestjs/common';
import { HealthCheckService, HttpHealthIndicator, HealthCheck, MemoryHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus';
import { AppLoggerService } from './app-logger.service';

@Injectable()
export class AppHealthService {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private logger: AppLoggerService,
  ) {
    this.logger.setContext('HealthService');
  }

  @HealthCheck()
  check() {
    const startTime = Date.now();
    
    return this.health.check([
      // Memory check
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
      
      // Disk check
      () => this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
      
      // External service checks (example)
      // () => this.http.pingCheck('google', 'https://google.com'),
    ]).then((result) => {
      const duration = Date.now() - startTime;
      this.logger.info('Health check completed', { duration, status: 'healthy' });
      return result;
    }).catch((error) => {
      const duration = Date.now() - startTime;
      this.logger.error('Health check failed', error.stack, { duration, status: 'unhealthy' });
      throw error;
    });
  }
}
