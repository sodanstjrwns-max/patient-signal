import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // 【보안】GET /debug/env 제거 — 인증 없이 OPENAI_API_KEY 앞 7자·각 키 길이/존재 여부를
  // 익명 호출자에게 노출하던 진단 라우트였음. 키 설정 점검은 Render 환경변수 콘솔에서 수행할 것.
}
