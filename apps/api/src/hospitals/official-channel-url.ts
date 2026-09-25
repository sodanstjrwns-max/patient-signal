import { BadRequestException } from '@nestjs/common';
import { registerDecorator, ValidationOptions } from 'class-validator';

export const OFFICIAL_CHANNEL_FIELDS = ['websiteUrl', 'blogUrl', 'instagramUrl', 'youtubeUrl'] as const;
export type OfficialChannelField = typeof OFFICIAL_CHANNEL_FIELDS[number];

const CHANNEL_ERRORS: Record<OfficialChannelField, string> = {
  websiteUrl: '홈페이지 주소는 올바른 http 또는 https URL로 입력해 주세요.',
  blogUrl: '블로그 주소는 계정이 포함된 블로그 URL로 입력해 주세요.',
  instagramUrl: '인스타그램 주소는 instagram.com/계정 형태로 입력해 주세요.',
  youtubeUrl: '유튜브 주소는 youtube.com/@계정 또는 채널 URL로 입력해 주세요.',
};

/** Normalize user-owned profile URLs without fetching the destination. */
export function normalizeOfficialChannelUrl(
  value: unknown,
  field: OfficialChannelField,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || (typeof value === 'string' && !value.trim())) return null;
  const invalid = () => new BadRequestException(CHANNEL_ERRORS[field]);
  if (typeof value !== 'string' || value.length > 2048) throw invalid();
  const input = value.trim();
  if (/[\s\\\u0000-\u001f\u007f]/.test(input)) throw invalid();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
  } catch {
    throw invalid();
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(url.hostname) ||
      !url.hostname.includes('.') || url.hostname.includes('..')) throw invalid();

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  if (field === 'instagramUrl') {
    if (!['instagram.com', 'm.instagram.com'].includes(host) ||
        !/^\/[a-z\d._]{1,30}$/i.test(path) ||
        ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'about', 'developer', 'legal'].includes(path.slice(1).toLowerCase())) {
      throw invalid();
    }
    url.hostname = 'www.instagram.com';
    url.pathname = `${path}/`;
    url.search = '';
  } else if (field === 'youtubeUrl') {
    if (!['youtube.com', 'm.youtube.com'].includes(host) ||
        !/^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)$/.test(path)) throw invalid();
    url.hostname = 'www.youtube.com';
    url.pathname = path;
    url.search = '';
  } else if (field === 'blogUrl') {
    if (['blog.naver.com', 'm.blog.naver.com'].includes(host)) {
      const account = /^\/[a-z\d_-]+$/i.test(path) ? path.slice(1) : url.searchParams.get('blogId');
      if (!account || !/^[a-z\d_-]+$/i.test(account)) throw invalid();
      url.hostname = 'blog.naver.com';
      url.pathname = `/${account}`;
      url.search = '';
    } else if (['naver.com', 'tistory.com', 'medium.com', 'velog.io', 'brunch.co.kr'].includes(host) && !path) {
      throw invalid();
    }
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|igsh$|si$)/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

export function normalizeOfficialChannels(dto: Partial<Record<OfficialChannelField, unknown>>) {
  return Object.fromEntries(OFFICIAL_CHANNEL_FIELDS.map((field) => [field, normalizeOfficialChannelUrl(dto[field], field)])) as
    Record<OfficialChannelField, string | null | undefined>;
}

export function IsOfficialChannelUrl(field: OfficialChannelField, options?: ValidationOptions) {
  return (object: object, propertyName: string) => registerDecorator({
    name: 'isOfficialChannelUrl',
    target: object.constructor,
    propertyName,
    options: { message: CHANNEL_ERRORS[field], ...options },
    validator: {
      validate(value: unknown) {
        try { normalizeOfficialChannelUrl(value, field); return true; } catch { return false; }
      },
    },
  });
}
