/**
 * Typed error hierarchy for cjig
 *
 * Exit codes: 0=success, 1=unknown, 2=connection, 3=timeout, 4=no-page, 5=eval-error
 */

export type ErrorCategory = 'connection' | 'timeout' | 'no-page' | 'evaluation' | 'config';

export class CjigError extends Error {
  constructor(
    message: string,
    readonly category: ErrorCategory,
    readonly retryable: boolean,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = 'CjigError';
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      category: this.category,
      retryable: this.retryable,
      exitCode: this.exitCode,
    };
  }
}

export class ConnectionError extends CjigError {
  constructor(
    message: string,
    readonly host: string,
    readonly port: number,
  ) {
    super(message, 'connection', true, 2);
    this.name = 'ConnectionError';
  }
}

export class TimeoutError extends CjigError {
  constructor(message: string) {
    super(message, 'timeout', true, 3);
    this.name = 'TimeoutError';
  }
}

export class NoPageError extends CjigError {
  constructor(message: string = 'No page selected') {
    super(message, 'no-page', false, 4);
    this.name = 'NoPageError';
  }
}

export class EvaluationError extends CjigError {
  constructor(message: string) {
    super(message, 'evaluation', false, 5);
    this.name = 'EvaluationError';
  }
}
