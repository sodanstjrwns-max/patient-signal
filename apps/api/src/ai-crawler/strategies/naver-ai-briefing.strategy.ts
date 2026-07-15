import { AIPlatform } from '@prisma/client';
import { AIQueryResult } from '../types';
import { PlatformStrategy, PlatformQueryContext } from './platform-strategy.interface';

/**
 * 【NEW】네이버 AI 브리핑 수집 전략 — 모바일 검색 SERP 직접 수집
 *
 * 구조: HyperCLOVA X(생성) + 네이버 검색 그라운딩(출처). 공식 API 미제공.
 * 방식: m.search.naver.com 모바일 SERP를 plain fetch → 원본 HTML 안에
 *       aibAnswer JSON 페이로드("body":{"templateId":"aibAnswer"...})가 통째로 존재
 *       → balanced-brace 파싱으로 추출 (JS 렌더링/브라우저 불필요).
 *
 * 파일럿 검증 (2026-07-14, 200쿼리): 노출률 8.0%, 차단 0, 에러 0.
 *  - iPhone UA + ko-KR 헤더 필수
 *  - 쿼리 간 3~7초 랜덤 딜레이는 호출자(스케줄러)가 담당
 *
 * 미노출 처리: "미노출도 데이터" — 노출 여부 자체가 핵심 지표이므로
 *  미노출 시에도 에러를 던지지 않고 마커 텍스트로 레코드를 남긴다.
 */

const NAVER_MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export const NAVER_BRIEFING_NOT_SHOWN_MARKER = '[AI 브리핑 미노출]';

interface AibSource {
  gdid?: string;
  official?: boolean;
  title?: string;
  content?: string;
  sourceName?: string;
  url?: string;
  platform?: string;
  footnoteSourceIndex?: number;
  dateText?: string;
}

export class NaverAiBriefingStrategy implements PlatformStrategy {
  readonly platform: AIPlatform = 'NAVER_AI_BRIEFING';
  readonly displayName = 'Naver AI Briefing';

  constructor(private readonly ctx: PlatformQueryContext) {}

  async query(promptText: string, hospitalName: string): Promise<AIQueryResult> {
    this.ctx.logger.log(`[Naver AI Briefing] 모바일 SERP 수집 시작: "${promptText.slice(0, 40)}"`);

    const url = `https://m.search.naver.com/search.naver?where=m&sm=mtp_hty.top&query=${encodeURIComponent(promptText)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': NAVER_MOBILE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`네이버 모바일 SERP 응답 오류: HTTP ${response.status}`);
    }

    const html = await response.text();

    // 차단/캡차 감지 — 이 경우는 확실한 실패이므로 에러로 처리 (재시도/알림 대상)
    if (/captcha|자동입력\s*방지|비정상적인\s*(검색|접근)/i.test(html) && html.length < 50000) {
      throw new Error('네이버 차단 의심: 캡차/비정상 접근 페이지 감지');
    }

    const briefing = this.extractAibAnswer(html);

    if (!briefing) {
      // 미노출: 에러가 아니라 유효한 관측치 → 마커 텍스트로 저장
      const notShownText = `${NAVER_BRIEFING_NOT_SHOWN_MARKER} 해당 검색어에서 네이버 AI 브리핑이 노출되지 않았습니다.`;
      const result = this.ctx.analyzeResponse(notShownText, hospitalName, 'NAVER_AI_BRIEFING', 'naver-aib-serp');
      result.isMentioned = false;
      result.mentionPosition = null;
      result.isWebSearch = true;
      result.isVerified = true;
      result.verificationSource = 'naver_serp_not_shown';
      this.ctx.logger.log(`[Naver AI Briefing] 미노출 (HTML ${html.length}자)`);
      return result;
    }

    const props = briefing.props || {};
    const summaryText: string =
      props.summary?.copy || this.stripMarkdown(props.summary?.markdown || '') || '';
    const sources: AibSource[] = Array.isArray(props.sources) ? props.sources : [];
    const relatedQuestions: string[] = Array.isArray(props.relatedQuestions)
      ? props.relatedQuestions.map((q: any) => (typeof q === 'string' ? q : q?.text || q?.query || '')).filter(Boolean)
      : [];

    // 응답 본문 구성: 요약 + 출처 목록 (분석기가 출처 텍스트에서도 언급을 잡을 수 있도록)
    const sourceLines = sources
      .map((s, i) => `[출처 ${i + 1}] ${s.sourceName || ''} - ${s.title || ''} (${s.url || ''})${s.official ? ' [공식]' : ''}`)
      .join('\n');
    const fullText = [summaryText, sourceLines].filter(Boolean).join('\n\n');

    if (!fullText.trim()) {
      throw new Error('AI 브리핑 블록은 존재하나 본문 추출 실패 (스키마 변경 의심)');
    }

    const result = this.ctx.analyzeResponse(fullText, hospitalName, 'NAVER_AI_BRIEFING', 'naver-aib-serp');
    result.isWebSearch = true; // 검색 그라운딩 기반
    result.isVerified = true;
    result.verificationSource = 'naver_serp_shown';

    // 출처 URL → citedSources (그라운딩 출처가 이 플랫폼의 핵심 데이터)
    const sourceUrls = sources.map((s) => s.url).filter((u): u is string => !!u);
    result.citedSources = [...new Set([...result.citedSources, ...sourceUrls])].slice(0, 15);

    // 소스 힌트 구성
    const sourceItems = sources
      .filter((s) => !!s.url)
      .map((s) => ({
        url: s.url as string,
        domain: this.ctx.extractDomain(s.url as string),
        title: s.title || s.sourceName || '',
        type: 'grounding' as const, // 네이버 검색 그라운딩 출처
        platform: 'NAVER_AI_BRIEFING',
      }));
    const textHints = this.ctx.extractSourceHintsFromText(fullText);
    result.sourceHints = {
      sources: sourceItems,
      hintKeywords: [...textHints.hintKeywords, ...relatedQuestions.slice(0, 5)],
      estimatedSources: this.ctx.classifySources(sourceItems, textHints.hintKeywords),
    };

    this.ctx.logger.log(
      `[Naver AI Briefing] 노출 — 요약 ${summaryText.length}자, 출처 ${sources.length}개, 언급=${result.isMentioned}`,
    );
    return result;
  }

  /**
   * 원본 HTML에서 aibAnswer JSON 페이로드 추출.
   * `"templateId":"aibAnswer"`를 포함하는 `"body":{...}` 블록을
   * 문자열/이스케이프 인식 balanced-brace 매칭으로 잘라낸다.
   * (단순 depth 카운트는 문자열 내 중괄호에 깨짐 — 파일럿에서 검증된 방식)
   */
  private extractAibAnswer(html: string): any | null {
    const anchor = html.indexOf('"templateId":"aibAnswer"');
    if (anchor === -1) return null;

    // anchor 앞쪽에서 가장 가까운 `"body":{` 시작점 탐색
    const bodyKey = '"body":';
    let searchFrom = html.lastIndexOf(bodyKey, anchor);
    while (searchFrom !== -1) {
      let braceStart = searchFrom + bodyKey.length;
      while (braceStart < html.length && /\s/.test(html[braceStart])) braceStart++;
      if (html[braceStart] === '{') {
        const jsonStr = this.matchBalancedBraces(html, braceStart);
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed?.templateId === 'aibAnswer' || parsed?.props) return parsed;
          } catch {
            // 파싱 실패 시 더 앞쪽 body 후보로 계속
          }
        }
      }
      searchFrom = html.lastIndexOf(bodyKey, searchFrom - 1);
      // anchor에서 너무 멀어지면 중단 (200KB 이상 역방향 탐색 방지)
      if (searchFrom !== -1 && anchor - searchFrom > 200000) break;
    }
    return null;
  }

  /** 문자열 상태(in-string, escape)를 추적하는 balanced-brace 매칭 */
  private matchBalancedBraces(text: string, start: number): string | null {
    if (text[start] !== '{') return null;
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        if (inStr) escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  /** markdown → 평문 근사 변환 (summary.copy 부재 시 폴백) */
  private stripMarkdown(md: string): string {
    return md
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크
      .replace(/[*_`#>]+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
