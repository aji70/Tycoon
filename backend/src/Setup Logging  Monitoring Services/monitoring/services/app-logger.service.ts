import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { CorrelationIdService } from './correlation-id.service';
import { LogContext } from '../interfaces/log-context.interface';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor(
    private configService: ConfigService,
    private correlationIdService: CorrelationIdService,
  ) {
    this.initializeLogger();
  }

  setContext(context: string): void {
    this.context = context;
  }

  private initializeLogger(): void {
    const config = this.configService.get('logger');
    const transports: winston.transport[] = [];

    // Console transport
    if (config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: this.getFormat(config.format === 'pretty'),
        }),
      );
    }

    // File transport with rotation
    if (config.enableFileLogging) {
      transports.push(
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: config.maxSize,
          maxFiles: config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // Error logs separate file
      transports.push(
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: config.maxSize,
          maxFiles: config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    this.logger = winston.createLogger({
      level: config.level,
      transports,
      defaultMeta: {
        service: 'nestjs-app',
        environment: process.env.NODE_ENV,
      },
    });
  }

  private getFormat(pretty: boolean = false) {
    const baseFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    if (pretty) {
      return winston.format.combine(
        baseFormat,
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, correlationId, ...meta }) => {
          const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
          const contextStr = context ? `[${context}]` : '';
          const correlationStr = correlationId ? `[${correlationId}]` : '';
          return `${timestamp} ${level} ${contextStr}${correlationStr} ${message}${metaStr}`;
        }),
      );
    }

    return baseFormat;
  }

  private formatMessage(message: any, context?: LogContext): any {
    const correlationId = this.correlationIdService.getId();
    
    return {
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      context: this.context,
      correlationId,
      ...context,
    };
  }

  log(message: any, context?: LogContext): void {
    this.logger.info(this.formatMessage(message, context));
  }

  info(message: any, context?: LogContext): void {
    this.logger.info(this.formatMessage(message, context));
  }

  error(message: any, trace?: string, context?: LogContext): void {
    this.logger.error(this.formatMessage(message, { ...context, trace }));
  }

  warn(message: any, context?: LogContext): void {
    this.logger.warn(this.formatMessage(message, context));
  }

  debug(message: any, context?: LogContext): void {
    this.logger.debug(this.formatMessage(message, context));
  }

  verbose(message: any, context?: LogContext): void {
    this.logger.verbose(this.formatMessage(message, context));
  }

  // Performance logging
  logPerformance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      operation,
      duration,
      type: 'performance',
    });
  }

  // Business event logging
  logBusinessEvent(event: string, data?: any, context?: LogContext): void {
    this.info(`Business Event: ${event}`, {
      ...context,
      event,
      data,
      type: 'business-event',
    });
  }

  // Security event logging
  logSecurityEvent(event: string, details?: any, context?: LogContext): void {
    this.warn(`Security Event: ${event}`, {
      ...context,
      event,
      details,
      type: 'security-event',
    });
  }
}