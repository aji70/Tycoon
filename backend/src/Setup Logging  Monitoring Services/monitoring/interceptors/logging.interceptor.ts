import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AppLoggerService } from '../services/app-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logger: AppLoggerService) {
    this.logger.setContext('Interceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.debug(`${className}.${methodName} executed successfully`, {
          className,
          methodName,
          duration,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(`${className}.${methodName} failed`, error.stack, {
          className,
          methodName,
          duration,
          error: error.message,
        });
        return throwError(() => error);
      }),
    );
  }
}
