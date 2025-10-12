import { ConfigModule, ConfigService } from '@nestjs/config';

export const loggerConfig = () => ({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json', // 'json' | 'pretty'
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    enableConsole: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
  },
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      enabled: process.env.ENABLE_SENTRY === 'true',
    },
    health: {
      enabled: process.env.ENABLE_HEALTH_CHECKS !== 'false',
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
    },
  },
});