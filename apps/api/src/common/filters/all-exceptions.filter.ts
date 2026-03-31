/**
 * C2: 글로벌 HTTP 예외 필터
 * 모든 에러를 일관된 형태로 변환하고, 상세 로깅을 수행합니다.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      message = typeof exResponse === 'string'
        ? exResponse
        : (exResponse as any).message || exception.message;
      errorCode = this.getErrorCode(status);
    } else if (exception instanceof Error) {
      message = exception.message;

      // AI API 에러 분류
      if (message.includes('429') || message.includes('rate_limit')) {
        status = HttpStatus.TOO_MANY_REQUESTS;
        errorCode = 'AI_RATE_LIMIT';
      } else if (message.includes('timeout') || message.includes('타임아웃')) {
        status = HttpStatus.GATEWAY_TIMEOUT;
        errorCode = 'AI_TIMEOUT';
      } else if (message.includes('CircuitBreaker')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        errorCode = 'CIRCUIT_BREAKER_OPEN';
      } else if (message.includes('API') && message.includes('초기화')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        errorCode = 'AI_NOT_CONFIGURED';
      }
    }

    // 500+ 에러만 상세 로깅 (4xx는 warn)
    const logData = {
      statusCode: status,
      errorCode,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      userId: (request as any).user?.id,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} → ${status}: ${message}`);
    }

    response.status(status).json({
      success: false,
      errorCode,
      message: Array.isArray(message) ? message[0] : message,
      timestamp: logData.timestamp,
      path: request.url,
    });
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 429: return 'RATE_LIMIT';
      default: return `HTTP_${status}`;
    }
  }
}
