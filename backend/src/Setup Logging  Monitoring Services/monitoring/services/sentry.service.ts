import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryService {
  constructor(private configService: ConfigService) {
    this.initializeSentry();
  }

  private initializeSentry(): void {
    const config = this.configService.get('monitoring.sentry');
    
    if (config.enabled && config.dsn) {
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: undefined }),
        ],
        tracesSampleRate: 0.1,
        beforeSend(event) {
          // Filter out non-critical errors in development
          if (config.environment === 'development' && event.level === 'warning') {
            return null;
          }
          return event;
        },
      });
    }
  }

  captureException(error: Error, context?: any): void {
    const config = this.configService.get('monitoring.sentry');
    if (config.enabled) {
      Sentry.withScope((scope) => {
        if (context) {
          scope.setContext('additional', context);
        }
        Sentry.captureException(error);
      });
    }
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: any): void {
    const config = this.configService.get('monitoring.sentry');
    if (config.enabled) {
      Sentry.withScope((scope) => {
        scope.setLevel(level);
        if (context) {
          scope.setContext('additional', context);
        }
        Sentry.captureMessage(message);
      });
    }
  }

  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    const config = this.configService.get('monitoring.sentry');
    if (config.enabled) {
      Sentry.addBreadcrumb(breadcrumb);
    }
  }
}
