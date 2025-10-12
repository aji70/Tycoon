import { Module, MiddlewareConsumer, Global } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';

// Config
import { loggerConfig } from './config/logger.config';

// Services
import { CorrelationIdService } from './services/correlation-id.service';
import { AppLoggerService } from './services/app-logger.service';
import { SentryService } from './services/sentry.service';
import { AppHealthService } from './services/health.service';

// Middleware
import { LoggingMiddleware } from './middleware/logging.middleware';

// Filters
import { GlobalExceptionFilter } from './filters/global-exception.filter';

// Interceptors
import { LoggingInterceptor } from './interceptors/logging.interceptor';

// Controllers
import { HealthController } from './controllers/health.controller';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [loggerConfig],
      isGlobal: true,
    }),
    TerminusModule,
    HttpModule,
  ],
  providers: [
    CorrelationIdService,
    AppLoggerService,
    SentryService,
    AppHealthService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  controllers: [HealthController],
  exports: [
    AppLoggerService,
    SentryService,
    CorrelationIdService,
  ],
})
export class MonitoringModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}