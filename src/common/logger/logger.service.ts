import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger = new Logger('App');

  log(message: string, context?: string, meta?: Record<string, unknown>) {
    this.logger.log(this.format(message, meta), context);
  }

  warn(message: string, context?: string, meta?: Record<string, unknown>) {
    this.logger.warn(this.format(message, meta), context);
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, trace, context);
  }

  debug(message: string, context?: string, meta?: Record<string, unknown>) {
    this.logger.debug(this.format(message, meta), context);
  }

  private format(message: string, meta?: Record<string, unknown>) {
    if (!meta) {
      return message;
    }
    try {
      return `${message} ${JSON.stringify(meta)}`;
    } catch {
      return message;
    }
  }
}
