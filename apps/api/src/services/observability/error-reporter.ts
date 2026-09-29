export interface ErrorReporterContext {
  userId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
}

export interface ErrorReporter {
  captureException(error: Error | any, context?: ErrorReporterContext): void;
  captureMessage(message: string, level?: 'info' | 'warn' | 'error', context?: ErrorReporterContext): void;
}

export class ConsoleErrorReporter implements ErrorReporter {
  captureException(error: Error | any, context?: ErrorReporterContext): void {
    const errorPayload = {
      timestamp: new Date().toISOString(),
      level: 'error',
      name: error?.name || 'Error',
      message: error?.message || String(error),
      code: error?.code,
      stack: error?.stack,
      context,
    };
    console.error(`🚨 [ErrorReporter] ${JSON.stringify(errorPayload, null, 2)}`);
  }

  captureMessage(message: string, level: 'info' | 'warn' | 'error' = 'info', context?: ErrorReporterContext): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    if (level === 'error') {
      console.error(`🚨 [ErrorReporter] ${JSON.stringify(payload)}`);
    } else if (level === 'warn') {
      console.warn(`⚠️ [ErrorReporter] ${JSON.stringify(payload)}`);
    } else {
      console.log(`ℹ️ [ErrorReporter] ${JSON.stringify(payload)}`);
    }
  }
}

let errorReporterInstance: ErrorReporter = new ConsoleErrorReporter();

export function getErrorReporter(): ErrorReporter {
  return errorReporterInstance;
}

export function setErrorReporter(reporter: ErrorReporter): void {
  errorReporterInstance = reporter;
}
