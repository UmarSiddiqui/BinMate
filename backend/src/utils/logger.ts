import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/** Structured logger for BinMate backend. Never log PII (addresses, tokens, user IDs). */
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(({ level, message, timestamp, stack, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return stack
        ? `${timestamp} [${level}] ${message}\n${stack}${metaStr}`
        : `${timestamp} [${level}] ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), winston.format.simple()),
    }),
  ],
});

export { logger };
