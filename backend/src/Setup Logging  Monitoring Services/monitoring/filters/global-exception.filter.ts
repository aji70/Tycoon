import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AppLoggerService } from '../services/app-logger.service';
import { SentryService } from '../services/sentry.service';
import { CorrelationIdService } from '../services/correlation-id.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private logger: AppLoggerService,
    private sentryService: SentryService,
    private correlationIdService: CorrelationIdService,
  ) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    const correlationId = this.correlationIdService.getId();

    const errorContext = {
      correlationId,
      method: request.method,
      url: request.originalUrl,
      statusCode: status,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    // Log error
    this.logger.error(
      `Exception occurred: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
      errorContext,
    );

    // Send to Sentry for 5xx errors
    if (status >= 500 && exception instanceof Error) {
      this.sentryService.captureException(exception, errorContext);
    }

    // Send response
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      correlationId,
    });
  }
}
