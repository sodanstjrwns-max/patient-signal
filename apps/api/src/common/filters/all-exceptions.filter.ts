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
import { Prisma } from '@prisma/client';

/**
 * 【P1-2】 클라이언트에 노출해도 안전한 기본 5xx 메시지.
 * DB 스키마/쿼리 조각이 그대로 나가는 것을 막습니다.
 */
const GENERIC_5XX_MESSAGE = '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

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
    /** 【P1-2】 클라이언트 응답에 원본 message를 실어도 되는지 여부 */
    let isClientSafeMessage = false;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      message = typeof exResponse === 'string'
        ? exResponse
        : (exResponse as any).message || exception.message;
      errorCode = this.getErrorCode(status);
      isClientSafeMessage = true;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // 【P1-2】 Prisma 에러를 사용자용 메시지로 치환 (원문은 로그에만 남김)
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      errorCode = mapped.errorCode;
      message = mapped.message;
      isClientSafeMessage = true;
    } else if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      // 【P1-2】 쿼리 구조/컬럼명이 그대로 노출되므로 절대 원문을 내보내지 않음
      const isValidation = exception instanceof Prisma.PrismaClientValidationError;
      status = isValidation ? HttpStatus.BAD_REQUEST : HttpStatus.SERVICE_UNAVAILABLE;
      errorCode = isValidation ? 'INVALID_QUERY' : 'DATABASE_UNAVAILABLE';
      message = isValidation
        ? '요청 형식이 올바르지 않습니다.'
        : '일시적으로 데이터베이스에 접근할 수 없습니다. 잠시 후 다시 시도해 주세요.';
      isClientSafeMessage = true;
    } else if (exception instanceof Error) {
      message = exception.message;

      // AI API 에러 분류
      if (message.includes('429') || message.includes('rate_limit')) {
        status = HttpStatus.TOO_MANY_REQUESTS;
        errorCode = 'AI_RATE_LIMIT';
        isClientSafeMessage = true;
      } else if (message.includes('timeout') || message.includes('타임아웃')) {
        status = HttpStatus.GATEWAY_TIMEOUT;
        errorCode = 'AI_TIMEOUT';
        isClientSafeMessage = true;
      } else if (message.includes('CircuitBreaker')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        errorCode = 'CIRCUIT_BREAKER_OPEN';
        isClientSafeMessage = true;
      } else if (message.includes('API') && message.includes('초기화')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        errorCode = 'AI_NOT_CONFIGURED';
        isClientSafeMessage = true;
      }
      // 그 외 분류되지 않은 Error → 500 + 일반 메시지로 마스킹 (아래에서 처리)
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
        `${request.method} ${request.url} → ${status} [${errorCode}] ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} → ${status} [${errorCode}]: ${
          exception instanceof Error ? exception.message : message
        }`,
      );
    }

    // 【P1-2】 분류되지 않은 내부 에러는 원문 대신 일반 메시지로 마스킹
    const clientMessage = isClientSafeMessage
      ? (Array.isArray(message) ? message[0] : message)
      : GENERIC_5XX_MESSAGE;

    // 【PS-통합】Patient Series Open API v1 (/api/v1/*)는 §1 규격 에러 포맷 사용:
    // { "error": { "code": "...", "message": "..." } }
    // 가드/서비스가 { error: { code, message } } 형태로 던지면 그대로 보존
    if (request.url.startsWith('/api/v1/')) {
      let psCode = errorCode;
      let psMessage = clientMessage;
      if (exception instanceof HttpException) {
        const exResponse = exception.getResponse();
        const psError = (exResponse as any)?.error;
        if (psError?.code) {
          psCode = psError.code;
          psMessage = psError.message || psMessage;
        }
      }
      response.status(status).json({ error: { code: psCode, message: psMessage } });
      return;
    }

    response.status(status).json({
      success: false,
      errorCode,
      message: clientMessage,
      timestamp: logData.timestamp,
      path: request.url,
    });
  }

  /**
   * 【P1-2】 Prisma 알려진 에러코드 → HTTP 상태 + 사용자용 한국어 메시지
   * https://www.prisma.io/docs/reference/api-reference/error-reference
   */
  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    errorCode: string;
    message: string;
  } {
    switch (e.code) {
      case 'P2002': {
        const target = (e.meta as any)?.target;
        const field = Array.isArray(target) ? target.join(', ') : target;
        return {
          status: HttpStatus.CONFLICT,
          errorCode: 'DUPLICATE_ENTRY',
          message: field
            ? `이미 등록된 값입니다. (${field})`
            : '이미 등록된 값입니다.',
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          errorCode: 'NOT_FOUND',
          message: '요청하신 데이터를 찾을 수 없습니다.',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          errorCode: 'INVALID_REFERENCE',
          message: '연결된 데이터가 존재하지 않습니다.',
        };
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          errorCode: 'RELATION_VIOLATION',
          message: '다른 데이터와 연결되어 있어 처리할 수 없습니다.',
        };
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          errorCode: 'VALUE_TOO_LONG',
          message: '입력값이 너무 깁니다.',
        };
      case 'P2011':
        return {
          status: HttpStatus.BAD_REQUEST,
          errorCode: 'NULL_CONSTRAINT',
          message: '필수 항목이 누락되었습니다.',
        };
      case 'P1001':
      case 'P1002':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          errorCode: 'DATABASE_UNAVAILABLE',
          message: '일시적으로 데이터베이스에 접근할 수 없습니다. 잠시 후 다시 시도해 주세요.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          errorCode: 'DATABASE_ERROR',
          message: GENERIC_5XX_MESSAGE,
        };
    }
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
