/**
 * Source Crawler — 인용된 URL의 페이지를 가져와서 메타/본문/감성 분석을 위한 raw 데이터 추출
 *
 * 전략:
 *  1) HTTP GET (axios, 15s timeout, UA 위장, 리다이렉트 최대 5회)
 *  2) OG/Twitter/Schema.org 메타 우선 추출 (소프트)
 *  3) Cheerio로 본문 추출 (풀 크롤링)
 *  4) 인스타는 별도 핸들러 (oEmbed + 메타)
 *  5) 실패 시 fetchStatus 기록 (blocked/timeout/error)
 */
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

export interface CrawlResult {
  fetchStatus: 'success' | 'blocked' | 'not_found' | 'timeout' | 'error';
  httpStatus?: number;
  errorMessage?: string;
  durationMs: number;

  // 메타
  title?: string;
  description?: string;
  ogImage?: string;
  author?: string;
  publisher?: string;
  publishedAt?: Date;
  language?: string;

  // 본문
  bodyText?: string;
  bodyLength?: number;
  wordCount?: number;

  // 인스타 전용
  igHandle?: string;
  igMediaType?: 'reel' | 'post' | 'story' | 'tv';
  igCaption?: string;
}

@Injectable()
export class SourceCrawlerService {
  private readonly logger = new Logger(SourceCrawlerService.name);

  async crawl(url: string): Promise<CrawlResult> {
    const start = Date.now();
    try {
      // 인스타는 별도 핸들러
      if (this.isInstagram(url)) {
        return await this.crawlInstagram(url, start);
      }

      // 일반 페이지
      return await this.crawlGeneric(url, start);
    } catch (e: any) {
      return this.handleError(e, start);
    }
  }

  private isInstagram(url: string): boolean {
    try {
      const h = new URL(url).hostname;
      return h === 'instagram.com' || h === 'www.instagram.com' || h.endsWith('.instagram.com');
    } catch {
      return false;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 일반 웹페이지 크롤링
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  private async crawlGeneric(url: string, start: number): Promise<CrawlResult> {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      validateStatus: () => true,
      responseType: 'text',
      maxContentLength: 5 * 1024 * 1024, // 5MB
    });

    const durationMs = Date.now() - start;

    if (response.status === 404) {
      return { fetchStatus: 'not_found', httpStatus: 404, durationMs };
    }
    if (response.status === 403 || response.status === 401) {
      return { fetchStatus: 'blocked', httpStatus: response.status, durationMs };
    }
    if (response.status >= 400) {
      return {
        fetchStatus: 'error',
        httpStatus: response.status,
        errorMessage: `HTTP ${response.status}`,
        durationMs,
      };
    }

    const html = typeof response.data === 'string' ? response.data : '';
    if (!html || html.length < 100) {
      return { fetchStatus: 'error', httpStatus: response.status, errorMessage: 'Empty body', durationMs };
    }

    return this.parseHtml(html, response.status, durationMs);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HTML 파싱: 메타 + 본문
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  private parseHtml(html: string, httpStatus: number, durationMs: number): CrawlResult {
    const $ = cheerio.load(html);

    // 제거: script/style/noscript
    $('script, style, noscript, iframe, svg').remove();

    // ━ 메타 추출
    const meta = (name: string) =>
      $(`meta[property="${name}"]`).attr('content') ||
      $(`meta[name="${name}"]`).attr('content') ||
      undefined;

    const title =
      meta('og:title') ||
      meta('twitter:title') ||
      $('title').first().text().trim() ||
      undefined;

    const description =
      meta('og:description') ||
      meta('twitter:description') ||
      meta('description') ||
      undefined;

    const ogImage = meta('og:image') || meta('twitter:image') || undefined;

    const author =
      meta('author') ||
      meta('article:author') ||
      $('[itemprop="author"]').first().text().trim() ||
      $('.author, .writer, .byline').first().text().trim() ||
      undefined;

    const publisher = meta('og:site_name') || meta('publisher') || undefined;

    const publishedRaw =
      meta('article:published_time') ||
      meta('og:published_time') ||
      meta('pubdate') ||
      $('time[datetime]').first().attr('datetime') ||
      undefined;

    let publishedAt: Date | undefined;
    if (publishedRaw) {
      const d = new Date(publishedRaw);
      if (!isNaN(d.getTime())) publishedAt = d;
    }

    const language = $('html').attr('lang') || meta('og:locale') || undefined;

    // ━ 본문 추출 (휴리스틱)
    // 우선순위: article > main > [role=main] > .content/#content > body
    const candidates = [
      'article',
      'main',
      '[role="main"]',
      '.post-content, .article-content, .entry-content',
      '#content, .content',
      '.naver-blog-content, #postViewArea',
    ];
    let bodyText = '';
    for (const sel of candidates) {
      const el = $(sel).first();
      if (el.length) {
        bodyText = el.text().replace(/\s+/g, ' ').trim();
        if (bodyText.length > 200) break;
      }
    }
    if (!bodyText || bodyText.length < 200) {
      bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    }

    // 최대 8000자 캡
    if (bodyText.length > 8000) bodyText = bodyText.substring(0, 8000);

    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

    return {
      fetchStatus: 'success',
      httpStatus,
      durationMs,
      title: title?.substring(0, 500),
      description: description?.substring(0, 1000),
      ogImage: ogImage?.substring(0, 1000),
      author: author?.substring(0, 200),
      publisher: publisher?.substring(0, 200),
      publishedAt,
      language: language?.substring(0, 20),
      bodyText,
      bodyLength: bodyText.length,
      wordCount,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Instagram 크롤링 (oEmbed + 메타 폴백)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  private async crawlInstagram(url: string, start: number): Promise<CrawlResult> {
    // URL 파싱으로 핸들/미디어타입 추출
    const parsed = this.parseInstagramUrl(url);

    // 1) Instagram public HTML 시도 (메타태그는 봇한테도 일부 노출됨)
    try {
      const response = await axios.get(url, {
        timeout: 12000,
        maxRedirects: 3,
        headers: {
          'User-Agent': DEFAULT_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        validateStatus: () => true,
        responseType: 'text',
      });

      const durationMs = Date.now() - start;

      if (response.status === 200 && typeof response.data === 'string') {
        const $ = cheerio.load(response.data);
        const meta = (name: string) =>
          $(`meta[property="${name}"]`).attr('content') ||
          $(`meta[name="${name}"]`).attr('content') ||
          undefined;

        const ogTitle = meta('og:title');
        const ogDescription = meta('og:description');
        const ogImage = meta('og:image');

        // og:description은 보통 "X likes, Y comments - @handle on Date: \"캡션...\"" 같은 형태
        return {
          fetchStatus: 'success',
          httpStatus: 200,
          durationMs,
          title: ogTitle?.substring(0, 500),
          description: ogDescription?.substring(0, 1000),
          ogImage: ogImage?.substring(0, 1000),
          author: parsed.handle,
          publisher: 'Instagram',
          language: 'ko',
          igHandle: parsed.handle,
          igMediaType: parsed.mediaType,
          igCaption: this.extractCaptionFromOgDesc(ogDescription),
          bodyText: ogDescription, // 캡션을 본문으로
          bodyLength: ogDescription?.length || 0,
        };
      }

      // 401/403 → blocked
      if (response.status === 401 || response.status === 403) {
        return {
          fetchStatus: 'blocked',
          httpStatus: response.status,
          durationMs,
          igHandle: parsed.handle,
          igMediaType: parsed.mediaType,
          publisher: 'Instagram',
        };
      }

      return {
        fetchStatus: 'error',
        httpStatus: response.status,
        errorMessage: `IG HTTP ${response.status}`,
        durationMs,
        igHandle: parsed.handle,
        igMediaType: parsed.mediaType,
      };
    } catch (e: any) {
      return this.handleError(e, start, parsed);
    }
  }

  private parseInstagramUrl(url: string): { handle?: string; mediaType?: 'reel' | 'post' | 'story' | 'tv' } {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      if (!path) return {};
      const segs = path.split('/');
      const first = segs[0]?.toLowerCase();
      if (!first) return {};
      if (first === 'p') return { mediaType: 'post' };
      if (first === 'reel' || first === 'reels') return { mediaType: 'reel' };
      if (first === 'stories') return { mediaType: 'story' };
      if (first === 'tv') return { mediaType: 'tv' };
      if (first === 'explore' || first === 'popular' || first === 'tags') return {};
      // 핸들로 가정
      return { handle: `@${first}` };
    } catch {
      return {};
    }
  }

  private extractCaptionFromOgDesc(desc?: string): string | undefined {
    if (!desc) return undefined;
    // og:description 패턴: "1,234 likes, 56 comments - @handle on Date: "캡션""
    // 콜론 이후 캡션 추출
    const match = desc.match(/:\s*["“]?(.+?)["”]?\s*$/);
    if (match) return match[1].substring(0, 1000);
    return desc.substring(0, 1000);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  private handleError(e: any, start: number, igInfo?: { handle?: string; mediaType?: string }): CrawlResult {
    const durationMs = Date.now() - start;
    const code = (e as AxiosError)?.code;

    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      return { fetchStatus: 'timeout', errorMessage: 'Timeout', durationMs };
    }
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
      return { fetchStatus: 'error', errorMessage: code, durationMs };
    }

    return {
      fetchStatus: 'error',
      errorMessage: (e?.message || 'Unknown error').substring(0, 500),
      durationMs,
    };
  }
}
