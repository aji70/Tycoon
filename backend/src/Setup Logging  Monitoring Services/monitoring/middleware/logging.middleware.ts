import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLoggerService } from '../services/app-logger.service';
import { CorrelationIdService } from '../services/correlation-id.service';
import { SentryService } from '../services/sentry.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(
    private logger: AppLoggerService,
    private correlationIdService: CorrelationIdService,
    private sentryService: SentryService,
  ) {
    this.logger.setContext('HTTP');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = req.headers['x-correlation-id'] as string || 
                         this.correlationIdService.generateId();
    
    this.correlationIdService.run(correlationId, () => {
      const startTime = Date.now();
      
      // Set correlation ID in response header
      res.setHeader('x-correlation-id', correlationId);
      
      // Add Sentry breadcrumb
      this.sentryService.addBreadcrumb({
        message: `${req.method} ${req.originalUrl}`,
        category: 'http',
        data: {
          method: req.method,
          url: req.originalUrl,
          correlationId,
        },
      });

      // Log request
      this.logger.info(`Incoming request: ${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        correlationId,
      });

      // Log response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logContext = {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          correlationId,
        };

        if (res.statusCode >= 400) {
          this.logger.error(`Request failed: ${req.method} ${req.originalUrl}`, undefined, logContext);
        } else {
          this.logger.info(`Request completed: ${req.method} ${req.originalUrl}`, logContext);
        }

        // Log performance for slow requests
        if (duration > 1000) {
          this.logger.logPerformance(`${req.method} ${req.originalUrl}`, duration, logContext);
        }
      });

      next();
    });
  }
}
