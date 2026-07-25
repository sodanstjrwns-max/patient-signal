import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  resolveSupply,
  ZONE_LABELS,
  ZONE_GUIDE,
  DURABILITY_LABELS,
  type SupplyInfo,
} from './supply-index';
import {
  detectRegionLevel,
  classifyDifficulty,
  detectLanguage,
  analyzeDirectorBranding,
  extractDoctorNameCandidates,
  REGION_LEVEL_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_GUIDE,
  LANGUAGE_LABELS,
  type RegionLevel,
  type QueryDifficulty,
  type QueryLanguage,
} from './query-classifier';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  【Batch A】강의록 실행 지표 — 데이터는 이미 DB에 있고 계산만 없던 8항목
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  25번 문서당 인용 효율 (역인과 오류 차단)  ← 최우선. 제품이 유발 중인 오류를 멈춘다.
 *  20번 원장 실명 브랜딩률
 *  12·24번 지역 단위 배율표
 *  30·32번 소모/축적 + 포트폴리오 4구역
 *  AEO/GEO 분리 (isWebSearch)
 *  13번 언어별 성적표
 *  28-②번 질문 난이도별 SoV
 *  29번 부정 언급 조기경보
 *
 *  ⚠️ DB 마이그레이션 0. 전부 기존 컬럼으로 계산.
 */
@Injectable()
export class LectureMetricsService {
  private readonly logger = new Logger(LectureMetricsService.name);

  constructor(private prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════
  // 공통 로더
  // ═════════════════════════════════════════════════════════════

  private since(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async getHospitalContext(hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        name: true,
        nameAliases: true,
        websiteUrl: true,
        hospitalStrengths: true,
        regionSido: true,
        regionSigungu: true,
        regionDong: true,
      },
    });

    const ownDomains: string[] = [];
    if (hospital?.websiteUrl) {
      try {
        const raw = hospital.websiteUrl.startsWith('http')
          ? hospital.websiteUrl
          : `https://${hospital.websiteUrl}`;
        ownDomains.push(new URL(raw).hostname.replace(/^www\./, '').toLowerCase());
      } catch {
        /* 잘못된 URL은 무시 */
      }
    }
    return { hospital, ownDomains };
  }

  /** Gemini 리다이렉트 URL에서 실제 도메인 복원 (기존 컨트롤러 로직과 동일 규칙) */
  private extractRealDomainFromHint(source: any): string | null {
    if (!source || typeof source !== 'object') return null;
    const title = (source.title || '').toString().trim().toLowerCase();
    const domain = (source.domain || '').toString().trim().toLowerCase();
    const ok = (s: string) =>
      s.length > 0 && s.includes('.') && !s.includes(' ') && !s.includes('vertexaisearch');
    if (ok(title)) return title.replace(/^www\./, '');
    if (ok(domain)) return domain.replace(/^www\./, '');
    return null;
  }

  private domainOf(url: string): string | null {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * 응답 목록 → 도메인별 인용 통계
   * Gemini 리다이렉트는 sourceHints로 실도메인 복원 (기존 로직과 동일하게 유지)
   */
  private buildDomainStats(
    responses: Array<{
      citedSources: string[];
      citedUrl: string | null;
      aiPlatform: string;
      isMentioned: boolean;
      sourceHints: any;
      createdAt: Date;
    }>,
  ) {
    type Stat = {
      domain: string;
      citations: number;
      mentioned: number;
      platforms: Set<string>;
      firstCitedAt: Date;
      lastCitedAt: Date;
    };
    const map = new Map<string, Stat>();

    for (const r of responses) {
      const urls = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];

      // Gemini 힌트 도메인 목록
      const hintDomains: string[] = [];
      if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
        const sources = Array.isArray((r.sourceHints as any)?.sources)
          ? (r.sourceHints as any).sources
          : [];
        for (const s of sources) {
          const real = this.extractRealDomainFromHint(s);
          if (real) hintDomains.push(real);
        }
      }

      let hintIdx = 0;
      for (const url of urls) {
        let domain = this.domainOf(url);
        const isGeminiRedirect = url.includes(
          'vertexaisearch.cloud.google.com/grounding-api-redirect/',
        );
        if (r.aiPlatform === 'GEMINI' && isGeminiRedirect) {
          domain = hintDomains[hintIdx] || hintDomains[0] || null;
          hintIdx++;
        }
        if (!domain) continue;

        let s = map.get(domain);
        if (!s) {
          s = {
            domain,
            citations: 0,
            mentioned: 0,
            platforms: new Set(),
            firstCitedAt: r.createdAt,
            lastCitedAt: r.createdAt,
          };
          map.set(domain, s);
        }
        s.citations++;
        if (r.isMentioned) s.mentioned++;
        s.platforms.add(r.aiPlatform);
        if (r.createdAt < s.firstCitedAt) s.firstCitedAt = r.createdAt;
        if (r.createdAt > s.lastCitedAt) s.lastCitedAt = r.createdAt;
      }
    }

    return map;
  }

  // ═════════════════════════════════════════════════════════════
  // 【강의록 25번】문서당 인용 효율 — 역인과 오류 차단
  // ═════════════════════════════════════════════════════════════
  /**
   * 인용수 = 선호도 × 공급량 을 분해한다.
   *
   * efficiency = 인용수 ÷ 공급량지수  (상대값, 크면 클수록 "문서 1개가 일을 많이 한다")
   * 인용수 랭킹과 효율 랭킹의 순위차(rankDelta)를 보여줘서
   * "인스타 1위인데 효율은 12위" 같은 착시를 직접 깨준다.
   */
  async getCitationEfficiency(hospitalId: string, days = 30) {
    const { hospital, ownDomains } = await this.getHospitalContext(hospitalId);
    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: this.since(days) } },
      select: {
        citedSources: true,
        citedUrl: true,
        aiPlatform: true,
        isMentioned: true,
        sourceHints: true,
        createdAt: true,
      },
    });

    const stats = this.buildDomainStats(responses);
    if (stats.size === 0) {
      return {
        period: `최근 ${days}일`,
        hospitalName: hospital?.name ?? null,
        totalCitations: 0,
        channels: [],
        misleadingTop: [],
        hiddenGems: [],
        insight: '아직 인용 데이터가 없습니다. 크롤이 누적되면 채널별 효율이 계산됩니다.',
      };
    }

    const rows = [...stats.values()].map((s) => {
      const supply: SupplyInfo = resolveSupply(s.domain, ownDomains);
      // 효율 = 인용수 / 공급량지수. 지수는 인스타=1000 기준 상대값
      const efficiency = s.citations / Math.max(supply.index, 1);
      return {
        domain: s.domain,
        channelLabel: supply.label,
        citations: s.citations,
        companionRate: s.citations > 0 ? Math.round((s.mentioned / s.citations) * 100) : 0,
        platformCount: s.platforms.size,
        supplyIndex: supply.index,
        durability: supply.durability,
        durabilityLabel: DURABILITY_LABELS[supply.durability],
        zone: supply.zone,
        zoneLabel: ZONE_LABELS[supply.zone],
        /** 문서당 인용 효율 (상대값) */
        efficiency: Math.round(efficiency * 100) / 100,
      };
    });

    // 인용수 랭킹
    const byCitations = [...rows].sort((a, b) => b.citations - a.citations);
    const citationRank = new Map(byCitations.map((r, i) => [r.domain, i + 1]));
    // 효율 랭킹
    const byEfficiency = [...rows].sort((a, b) => b.efficiency - a.efficiency);
    const efficiencyRank = new Map(byEfficiency.map((r, i) => [r.domain, i + 1]));

    const channels = byEfficiency.map((r) => {
      const cRank = citationRank.get(r.domain)!;
      const eRank = efficiencyRank.get(r.domain)!;
      return {
        ...r,
        citationRank: cRank,
        efficiencyRank: eRank,
        /** 양수 = 인용수보다 효율이 좋다(숨은 보석) / 음수 = 인용수가 부풀려져 있다 */
        rankDelta: cRank - eRank,
      };
    });

    const totalCitations = rows.reduce((sum, r) => sum + r.citations, 0);

    // 인용수 Top이면서 효율 순위가 크게 밀린 = 착시 유발 채널
    const misleadingTop = channels
      .filter((c) => c.citationRank <= 5 && c.rankDelta <= -3)
      .sort((a, b) => a.rankDelta - b.rankDelta)
      .slice(0, 5);

    // 인용수는 낮은데 효율 Top = 숨은 보석
    const hiddenGems = channels
      .filter((c) => c.efficiencyRank <= 5 && c.rankDelta >= 3)
      .sort((a, b) => b.rankDelta - a.rankDelta)
      .slice(0, 5);

    return {
      period: `최근 ${days}일`,
      hospitalName: hospital?.name ?? null,
      totalCitations,
      uniqueDomains: rows.length,
      /** 효율 내림차순 */
      channels: channels.slice(0, 30),
      misleadingTop,
      hiddenGems,
      methodology:
        '인용수 = 선호도 × 공급량. 공급량지수는 채널별 병원 콘텐츠 모집단의 상대 크기(인스타=1000)이며, ' +
        '효율 = 인용수 ÷ 공급량지수 입니다. 인용수 1위가 곧 좋은 채널이 아니라는 것을 드러내기 위한 지표입니다.',
      insight:
        misleadingTop.length > 0
          ? `${misleadingTop[0].channelLabel}은(는) 인용수 ${misleadingTop[0].citationRank}위지만 문서당 효율은 ${misleadingTop[0].efficiencyRank}위입니다. 물량이 많아서 많이 인용된 것이지, 채널이 좋아서가 아닙니다.`
          : hiddenGems.length > 0
            ? `${hiddenGems[0].channelLabel}은(는) 인용수는 ${hiddenGems[0].citationRank}위에 불과하지만 문서당 효율은 ${hiddenGems[0].efficiencyRank}위입니다. 여기에 문서 1개를 더하는 게 물량 채널 100개보다 낫습니다.`
            : '아직 착시를 유발할 만한 채널 편중이 없습니다.',
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 【강의록 32·30번】포트폴리오 4구역 배치 + 소모/축적
  // ═════════════════════════════════════════════════════════════
  async getPortfolioMap(hospitalId: string, days = 30) {
    const { hospital, ownDomains } = await this.getHospitalContext(hospitalId);
    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: this.since(days) } },
      select: {
        citedSources: true,
        citedUrl: true,
        aiPlatform: true,
        isMentioned: true,
        sourceHints: true,
        createdAt: true,
      },
    });

    const stats = this.buildDomainStats(responses);
    const total = [...stats.values()].reduce((s, v) => s + v.citations, 0);

    type ZoneKey = SupplyInfo['zone'];
    const zoneAgg = new Map<
      ZoneKey,
      { citations: number; mentioned: number; domains: Set<string> }
    >();
    const durAgg = new Map<
      SupplyInfo['durability'],
      { citations: number; domains: Set<string> }
    >();

    for (const s of stats.values()) {
      const supply = resolveSupply(s.domain, ownDomains);
      const z =
        zoneAgg.get(supply.zone) || { citations: 0, mentioned: 0, domains: new Set<string>() };
      z.citations += s.citations;
      z.mentioned += s.mentioned;
      z.domains.add(s.domain);
      zoneAgg.set(supply.zone, z);

      const d = durAgg.get(supply.durability) || { citations: 0, domains: new Set<string>() };
      d.citations += s.citations;
      d.domains.add(s.domain);
      durAgg.set(supply.durability, d);
    }

    const ZONE_ORDER: ZoneKey[] = ['HOME_BASE', 'SNIPER', 'VOLUME', 'AVOID'];
    const zones = ZONE_ORDER.map((zone) => {
      const v = zoneAgg.get(zone) || { citations: 0, mentioned: 0, domains: new Set<string>() };
      return {
        zone,
        label: ZONE_LABELS[zone],
        guide: ZONE_GUIDE[zone],
        citations: v.citations,
        share: total > 0 ? Math.round((v.citations / total) * 1000) / 10 : 0,
        domainCount: v.domains.size,
        companionRate: v.citations > 0 ? Math.round((v.mentioned / v.citations) * 100) : 0,
      };
    });

    const DUR_ORDER: SupplyInfo['durability'][] = ['OWNED', 'ACCUMULATIVE', 'CONSUMABLE'];
    const durability = DUR_ORDER.map((key) => {
      const v = durAgg.get(key) || { citations: 0, domains: new Set<string>() };
      return {
        durability: key,
        label: DURABILITY_LABELS[key],
        citations: v.citations,
        share: total > 0 ? Math.round((v.citations / total) * 1000) / 10 : 0,
        domainCount: v.domains.size,
      };
    });

    const homeBase = zones.find((z) => z.zone === 'HOME_BASE')!;
    const avoid = zones.find((z) => z.zone === 'AVOID')!;
    const consumable = durability.find((d) => d.durability === 'CONSUMABLE')!;

    const warnings: string[] = [];
    if (homeBase.citations === 0) {
      warnings.push(
        '본진(홈페이지·GBP) 인용이 0건입니다. 강의록 2번 — 홈페이지가 최상위 출처인데 지금은 입장권조차 없는 상태입니다.',
      );
    } else if (homeBase.share < 5) {
      warnings.push(
        `본진 비중이 ${homeBase.share}%뿐입니다. 남의 채널에 얹혀 있는 구조라 통제권이 없습니다.`,
      );
    }
    if (avoid.share >= 20) {
      warnings.push(
        `'하지마' 구역 비중이 ${avoid.share}%입니다. 지식iN·네이버블로그 신규·티스토리 신규·PBN은 투입 대비 회수가 안 됩니다.`,
      );
    }
    if (consumable.share >= 60) {
      warnings.push(
        `소모형(수명 2~6주) 채널이 ${consumable.share}%입니다. 발행을 멈추면 가시성이 같이 사라집니다. 축적형 자산 비중을 올려야 합니다.`,
      );
    }

    return {
      period: `최근 ${days}일`,
      hospitalName: hospital?.name ?? null,
      totalCitations: total,
      zones,
      durability,
      warnings,
      methodology:
        '강의록 32번 포트폴리오 배치표(본진/고효율 저격수/물량 파도/하지마)와 30번 채널 수명(축적형 영구 vs 소모형 2~6주)을 인용 도메인에 매핑한 결과입니다.',
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 【강의록 12·24번】지역 단위 배율표
  // ═════════════════════════════════════════════════════════════
  /**
   * 강의록 실측 재현:
   *   전체   동 46.6% vs 시 27.3% = 1.7배
   *   Gemini 동 68.6% vs 시 22.8% = 3.0배  ← GBP가 교과서라서
   *   CLOVA X 동 5.9% vs 시 8.1% = 역전
   */
  async getRegionLeverage(hospitalId: string, days = 30) {
    const { hospital } = await this.getHospitalContext(hospitalId);
    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: this.since(days) } },
      select: {
        aiPlatform: true,
        isMentioned: true,
        archivedPromptText: true,
        prompt: { select: { promptText: true, regionKeywords: true } },
      },
    });

    type Bucket = { total: number; mentioned: number };
    const overall = new Map<RegionLevel, Bucket>();
    const byPlatform = new Map<string, Map<RegionLevel, Bucket>>();

    const bump = (m: Map<RegionLevel, Bucket>, level: RegionLevel, mentioned: boolean) => {
      const b = m.get(level) || { total: 0, mentioned: 0 };
      b.total++;
      if (mentioned) b.mentioned++;
      m.set(level, b);
    };

    for (const r of responses) {
      const text = r.prompt?.promptText || r.archivedPromptText || '';
      if (!text) continue;
      const level = detectRegionLevel(text, r.prompt?.regionKeywords || []);
      bump(overall, level, r.isMentioned);

      let pm = byPlatform.get(r.aiPlatform);
      if (!pm) {
        pm = new Map();
        byPlatform.set(r.aiPlatform, pm);
      }
      bump(pm, level, r.isMentioned);
    }

    const LEVEL_ORDER: RegionLevel[] = ['DONG', 'SIGUNGU', 'SIDO', 'NATIONWIDE', 'NONE'];
    const toRows = (m: Map<RegionLevel, Bucket>) =>
      LEVEL_ORDER.map((level) => {
        const b = m.get(level) || { total: 0, mentioned: 0 };
        return {
          level,
          label: REGION_LEVEL_LABELS[level],
          responses: b.total,
          mentioned: b.mentioned,
          mentionRate: b.total > 0 ? Math.round((b.mentioned / b.total) * 1000) / 10 : 0,
        };
      }).filter((r) => r.responses > 0);

    const overallRows = toRows(overall);
    const dong = overallRows.find((r) => r.level === 'DONG');
    const sigungu = overallRows.find((r) => r.level === 'SIGUNGU');
    const sido = overallRows.find((r) => r.level === 'SIDO');

    /** 좁은 지역이 넓은 지역 대비 몇 배 유리한가 */
    const leverage = (narrow?: { mentionRate: number }, wide?: { mentionRate: number }) =>
      narrow && wide && wide.mentionRate > 0
        ? Math.round((narrow.mentionRate / wide.mentionRate) * 100) / 100
        : null;

    const platforms = [...byPlatform.entries()]
      .map(([platform, m]) => {
        const rows = toRows(m);
        const d = rows.find((r) => r.level === 'DONG');
        const s = rows.find((r) => r.level === 'SIGUNGU');
        const si = rows.find((r) => r.level === 'SIDO');
        return {
          platform,
          rows,
          dongVsSigungu: leverage(d, s),
          dongVsSido: leverage(d, si),
          totalResponses: rows.reduce((sum, r) => sum + r.responses, 0),
        };
      })
      .sort((a, b) => b.totalResponses - a.totalResponses);

    // 역전 플랫폼 = 좁은 지역이 오히려 불리한 곳 (강의록: CLOVA X)
    const inverted = platforms.filter(
      (p) => p.dongVsSigungu !== null && p.dongVsSigungu < 1,
    );
    const bestLeverage = platforms
      .filter((p) => p.dongVsSigungu !== null)
      .sort((a, b) => (b.dongVsSigungu || 0) - (a.dongVsSigungu || 0))[0];

    return {
      period: `최근 ${days}일`,
      hospitalName: hospital?.name ?? null,
      hospitalRegion: hospital
        ? [hospital.regionSido, hospital.regionSigungu, hospital.regionDong]
            .filter(Boolean)
            .join(' ')
        : null,
      overall: overallRows,
      dongVsSigungu: leverage(dong, sigungu),
      dongVsSido: leverage(dong, sido),
      platforms,
      inverted: inverted.map((p) => ({ platform: p.platform, ratio: p.dongVsSigungu })),
      benchmark: {
        note: '강의록 실측 벤치마크',
        overallDongVsSigungu: 1.7,
        geminiDongVsSigungu: 3.0,
        source: '강의록 12번·24번 (동 46.6% vs 시 27.3%, Gemini 68.6% vs 22.8%)',
      },
      insight:
        dong && sigungu
          ? `동 단위 질문 언급률 ${dong.mentionRate}% vs 시/군/구 단위 ${sigungu.mentionRate}% — ${leverage(dong, sigungu)}배 유리합니다.` +
            (bestLeverage?.dongVsSigungu && bestLeverage.dongVsSigungu > 1.5
              ? ` 특히 ${bestLeverage.platform}은 ${bestLeverage.dongVsSigungu}배로, 좁은 지역 질문을 늘릴 여지가 가장 큽니다.`
              : '')
          : '지역 단위별 비교를 위해서는 동 단위 질문과 시/군/구 단위 질문이 모두 필요합니다.',
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 【강의록 20번】원장 실명 브랜딩률
  // ═════════════════════════════════════════════════════════════
  async getDirectorBranding(hospitalId: string, days = 30) {
    const { hospital } = await this.getHospitalContext(hospitalId);
    const doctorNames = hospital ? extractDoctorNameCandidates(hospital) : [];

    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: this.since(days) }, isMentioned: true },
      select: { responseText: true, aiPlatform: true },
    });

    let titleCount = 0;
    let realNameCount = 0;
    const nameHits = new Map<string, number>();
    const platformAgg = new Map<string, { total: number; title: number; realName: number }>();

    for (const r of responses) {
      const res = analyzeDirectorBranding(r.responseText, doctorNames);
      if (res.hasTitle) titleCount++;
      if (res.hasRealName) realNameCount++;
      for (const n of res.matchedNames) nameHits.set(n, (nameHits.get(n) || 0) + 1);

      const p = platformAgg.get(r.aiPlatform) || { total: 0, title: 0, realName: 0 };
      p.total++;
      if (res.hasTitle) p.title++;
      if (res.hasRealName) p.realName++;
      platformAgg.set(r.aiPlatform, p);
    }

    const total = responses.length;
    const titleRate = total > 0 ? Math.round((titleCount / total) * 1000) / 10 : 0;
    const realNameRate = total > 0 ? Math.round((realNameCount / total) * 1000) / 10 : 0;

    return {
      period: `최근 ${days}일`,
      hospitalName: hospital?.name ?? null,
      /** 병원 정보에서 추출한 원장 실명 후보 */
      doctorNameCandidates: doctorNames,
      mentionedResponses: total,
      titleMentions: titleCount,
      /** '원장/의료진' 같은 일반명사 언급률 */
      titleRate,
      realNameMentions: realNameCount,
      /** 실명이 등장한 비율 — 강의록 실측 0.7% */
      realNameRate,
      /** 일반명사는 나오는데 실명은 안 나오는 격차 */
      brandingGap: Math.round((titleRate - realNameRate) * 10) / 10,
      nameHits: [...nameHits.entries()].map(([name, count]) => ({ name, count })),
      byPlatform: [...platformAgg.entries()]
        .map(([platform, v]) => ({
          platform,
          responses: v.total,
          titleRate: v.total > 0 ? Math.round((v.title / v.total) * 1000) / 10 : 0,
          realNameRate: v.total > 0 ? Math.round((v.realName / v.total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.responses - a.responses),
      benchmark: {
        note: '강의록 실측 벤치마크',
        titleRate: 25.8,
        realNameRate: 0.7,
        source: '강의록 20번',
      },
      prescription:
        doctorNames.length === 0
          ? '원장 실명이 병원 정보에 등록되어 있지 않아 측정할 수 없습니다. 설정 > 병원 강점에 "○○○ 원장" 형태로 넣으면 자동 추적됩니다.'
          : realNameRate < 5
            ? `AI는 '원장'이라는 일반명사는 ${titleRate}% 언급하는데, 실명은 ${realNameRate}%뿐입니다. 실명이 엔티티로 학습되어 있지 않다는 뜻입니다. 처방: 나무위키·위키백과·네이버 인물정보에 원장 엔티티를 만드십시오.`
            : `실명 언급률 ${realNameRate}% — 강의록 벤치마크 0.7%를 크게 상회합니다. 원장 엔티티가 이미 학습된 상태입니다.`,
      insight: '강의록 20번: AI는 병원은 말해도 사람은 말하지 않는다. 실명이 엔티티가 되어야 사람이 브랜드가 된다.',
    };
  }

  // ═════════════════════════════════════════════════════════════
  // AEO vs GEO 분리 (isWebSearch)
  // ═════════════════════════════════════════════════════════════
  /**
   * 강의록: AEO = 실시간 검색 + RAG (반영 2~4주, 단기전)
   *         GEO = 사전학습 진입 (모델 업데이트 주기, 장기전)
   *
   * isWebSearch=false 인데 언급됐다 = 검색 없이도 안다 = **사전학습에 진입한 자산**
   * isWebSearch=true 에서만 언급된다 = 검색 의존 = AEO 성과
   */
  async getAeoGeoSplit(hospitalId: string, days = 30) {
    const { hospital } = await this.getHospitalContext(hospitalId);
    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: this.since(days) } },
      select: { isWebSearch: true, isMentioned: true, aiPlatform: true, recommendationDepth: true },
    });

    const agg = {
      webSearch: { total: 0, mentioned: 0 },
      noSearch: { total: 0, mentioned: 0 },
    };
    const platformAgg = new Map<
      string,
      { webTotal: number; webMentioned: number; noTotal: number; noMentioned: number }
    >();

    for (const r of responses) {
      const bucket = r.isWebSearch ? agg.webSearch : agg.noSearch;
      bucket.total++;
      if (r.isMentioned) bucket.mentioned++;

      const p =
        platformAgg.get(r.aiPlatform) ||
        { webTotal: 0, webMentioned: 0, noTotal: 0, noMentioned: 0 };
      if (r.isWebSearch) {
        p.webTotal++;
        if (r.isMentioned) p.webMentioned++;
      } else {
        p.noTotal++;
        if (r.isMentioned) p.noMentioned++;
      }
      platformAgg.set(r.aiPlatform, p);
    }

    const rate = (b: { total: number; mentioned: number }) =>
      b.total > 0 ? Math.round((b.mentioned / b.total) * 1000) / 10 : 0;

    const aeoRate = rate(agg.webSearch);
    const geoRate = rate(agg.noSearch);

    return {
      period: `최근 ${days}일`,
      hospitalName: hospital?.name ?? null,
      aeo: {
        label: 'AEO — 실시간 검색 + RAG',
        description: '검색을 거쳐 답한 응답. 반영 2~4주, 단기전.',
        responses: agg.webSearch.total,
        mentioned: agg.webSearch.mentioned,
        mentionRate: aeoRate,
      },
      geo: {
        label: 'GEO — 사전학습 진입',
        description: '검색 없이 답한 응답. 여기서 언급되면 모델이 우리를 이미 "알고" 있다는 뜻.',
        responses: agg.noSearch.total,
        mentioned: agg.noSearch.mentioned,
        mentionRate: geoRate,
      },
      /** GEO 진입 지수: 검색 없이도 아는 비율 ÷ 검색해서 아는 비율 */
      geoPenetration: aeoRate > 0 ? Math.round((geoRate / aeoRate) * 100) / 100 : null,
      byPlatform: [...platformAgg.entries()]
        .map(([platform, v]) => ({
          platform,
          aeoResponses: v.webTotal,
          aeoMentionRate: v.webTotal > 0 ? Math.round((v.webMentioned / v.webTotal) * 1000) / 10 : 0,
          geoResponses: v.noTotal,
          geoMentionRate: v.noTotal > 0 ? Math.round((v.noMentioned / v.noTotal) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.aeoResponses + b.geoResponses - (a.aeoResponses + a.geoResponses)),
      insight:
        agg.noSearch.total === 0
          ? '전체 응답이 웹 검색 모드입니다. 사전학습 진입(GEO) 여부는 검색 미사용 측정이 쌓여야 판정됩니다.'
          : geoRate === 0
            ? `검색을 끄면 언급률이 0%입니다. 지금 가시성은 100% AEO(실시간 검색) 성과이고, 모델 자체는 우리를 모릅니다. 장기전(GEO)은 아직 시작 전입니다.`
            : geoRate < aeoRate
              ? `검색 시 ${aeoRate}% / 검색 없이 ${geoRate}%. 사전학습 진입이 시작됐지만 여전히 검색 의존이 큽니다.`
              : `검색 없이도 ${geoRate}% 언급 — 모델이 우리를 학습했습니다. GEO 자산이 형성된 상태입니다.`,
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 【강의록 13번】언어별 성적표
  // ═════════════════════════════════════════════════════════════
  async getLanguageScoreboard(hospitalId: string, days = 30) {
    const { hospital } = await this.getHospitalContext(hospitalId);
    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: this.since(days) } },
      select: {
        isMentioned: true,
        mentionPosition: true,
        aiPlatform: true,
        archivedPromptText: true,
        prompt: { select: { promptText: true } },
      },
    });

    type Bucket = { total: number; mentioned: number; firstPosition: number };
    const agg = new Map<QueryLanguage, Bucket>();

    for (const r of responses) {
      const text = r.prompt?.promptText || r.archivedPromptText || '';
      if (!text) continue;
      const lang = detectLanguage(text);
      const b = agg.get(lang) || { total: 0, mentioned: 0, firstPosition: 0 };
      b.total++;
      if (r.isMentioned) {
        b.mentioned++;
        if (r.mentionPosition === 1) b.firstPosition++;
      }
      agg.set(lang, b);
    }

    const LANG_ORDER: QueryLanguage[] = ['KO', 'EN', 'ZH', 'JA', 'OTHER'];
    const rows = LANG_ORDER.map((lang) => {
      const b = agg.get(lang) || { total: 0, mentioned: 0, firstPosition: 0 };
      return {
        language: lang,
        label: LANGUAGE_LABELS[lang],
        responses: b.total,
        mentioned: b.mentioned,
        mentionRate: b.total > 0 ? Math.round((b.mentioned / b.total) * 1000) / 10 : 0,
        firstPositionShare:
          b.mentioned > 0 ? Math.round((b.firstPosition / b.mentioned) * 1000) / 10 : 0,
      };
    }).filter((r) => r.responses > 0);

    const ko = rows.find((r) => r.language === 'KO');
    const foreign = rows.filter((r) => r.language !== 'KO' && r.language !== 'OTHER');
    const foreignTotal = foreign.reduce((s, r) => s + r.responses, 0);
    const foreignMentioned = foreign.reduce((s, r) => s + r.mentioned, 0);
    const foreignRate =
      foreignTotal > 0 ? Math.round((foreignMentioned / foreignTotal) * 1000) / 10 : 0;

    return {
      period: `최근 ${days}일`,
      hospitalName: hospital?.name ?? null,
      rows,
      koreanMentionRate: ko?.mentionRate ?? 0,
      foreignMentionRate: foreignRate,
      foreignResponses: foreignTotal,
      /** 외국어가 한국어보다 유리한 배율 — 강의록 "무주공산" 검증 */
      foreignAdvantage:
        ko && ko.mentionRate > 0 ? Math.round((foreignRate / ko.mentionRate) * 100) / 100 : null,
      insight:
        foreignTotal === 0
          ? '외국어 질문이 없습니다. 강의록 13번 — 다국어는 무주공산입니다. 경쟁자가 아예 없는 영역에 질문을 심어보십시오.'
          : foreignRate > (ko?.mentionRate ?? 0)
            ? `외국어 질문 언급률 ${foreignRate}%가 한국어 ${ko?.mentionRate ?? 0}%보다 높습니다. 무주공산이 실제로 확인됩니다 — 다국어 콘텐츠 투자 회수율이 국내보다 좋습니다.`
            : `외국어 질문 언급률 ${foreignRate}% vs 한국어 ${ko?.mentionRate ?? 0}%. 외국어 영역에서 아직 우위를 못 잡았습니다.`,
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 【강의록 28-②】질문 난이도별 SoV — 쉬운 질문의 착시 제거
  // ═════════════════════════════════════════════════════════════
  async getDifficultyBreakdown(hospitalId: string, days = 30) {
    const { hospital } = await this.getHospitalContext(hospitalId);
    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: this.since(days) } },
      select: {
        isMentioned: true,
        mentionPosition: true,
        archivedPromptText: true,
        promptId: true,
        prompt: { select: { promptText: true, regionKeywords: true } },
      },
    });

    type Bucket = {
      total: number;
      mentioned: number;
      firstPosition: number;
      prompts: Set<string>;
    };
    const agg = new Map<QueryDifficulty, Bucket>();

    for (const r of responses) {
      const text = r.prompt?.promptText || r.archivedPromptText || '';
      if (!text) continue;
      const diff = classifyDifficulty(text, r.prompt?.regionKeywords || []);
      const b =
        agg.get(diff) || { total: 0, mentioned: 0, firstPosition: 0, prompts: new Set<string>() };
      b.total++;
      if (r.isMentioned) {
        b.mentioned++;
        if (r.mentionPosition === 1) b.firstPosition++;
      }
      if (r.promptId) b.prompts.add(r.promptId);
      agg.set(diff, b);
    }

    const ORDER: QueryDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
    const rows = ORDER.map((difficulty) => {
      const b =
        agg.get(difficulty) || { total: 0, mentioned: 0, firstPosition: 0, prompts: new Set<string>() };
      return {
        difficulty,
        label: DIFFICULTY_LABELS[difficulty],
        guide: DIFFICULTY_GUIDE[difficulty],
        responses: b.total,
        promptCount: b.prompts.size,
        mentioned: b.mentioned,
        sov: b.total > 0 ? Math.round((b.mentioned / b.total) * 1000) / 10 : 0,
        firstPositionShare:
          b.mentioned > 0 ? Math.round((b.firstPosition / b.mentioned) * 1000) / 10 : 0,
      };
    });

    const totalResponses = rows.reduce((s, r) => s + r.responses, 0);
    const easy = rows.find((r) => r.difficulty === 'EASY')!;
    const hard = rows.find((r) => r.difficulty === 'HARD')!;
    const overallSov =
      totalResponses > 0
        ? Math.round((rows.reduce((s, r) => s + r.mentioned, 0) / totalResponses) * 1000) / 10
        : 0;

    const easyShare =
      totalResponses > 0 ? Math.round((easy.responses / totalResponses) * 1000) / 10 : 0;

    const warnings: string[] = [];
    if (easyShare >= 60) {
      warnings.push(
        `전체 질문의 ${easyShare}%가 쉬운(롱테일·저경쟁) 질문입니다. 종합 SoV ${overallSov}%는 실력보다 질문 구성이 만든 숫자일 수 있습니다.`,
      );
    }
    if (easy.sov - hard.sov >= 30 && hard.responses > 0) {
      warnings.push(
        `쉬운 질문 SoV ${easy.sov}% vs 어려운 질문 ${hard.sov}% — 격차 ${Math.round((easy.sov - hard.sov) * 10) / 10}%p. 빅키워드에서는 아직 안 보입니다.`,
      );
    }
    if (hard.responses === 0) {
      warnings.push(
        '어려운(빅키워드) 질문이 하나도 없습니다. 지금 SoV로는 실제 경쟁력을 알 수 없습니다.',
      );
    }

    return {
      period: `최근 ${days}일`,
      hospitalName: hospital?.name ?? null,
      overallSov,
      totalResponses,
      rows,
      easyShare,
      /** 착시 보정 SoV: 난이도 3구간 단순평균 (질문 구성 편중 제거) */
      balancedSov:
        rows.filter((r) => r.responses > 0).length > 0
          ? Math.round(
              (rows.filter((r) => r.responses > 0).reduce((s, r) => s + r.sov, 0) /
                rows.filter((r) => r.responses > 0).length) *
                10,
            ) / 10
          : 0,
      warnings,
      methodology:
        '난이도는 지역 범위(동<시<도<전국) + 비교·추천 요구 + 조건 개수로 판정합니다. ' +
        '종합 SoV는 쉬운 질문 비중에 좌우되므로, 난이도 3구간 단순평균(balancedSov)을 함께 봐야 착시가 사라집니다.',
      insight: '강의록 28-②: 쉬운 질문만 넣고 SoV 90%를 자랑하는 건 경쟁 없는 곳에서 이긴 것이다.',
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 【강의록 29번】부정 언급 조기경보
  // ═════════════════════════════════════════════════════════════
  /**
   * 강의록: 긍정 88.9 / 중립 11.0 / 부정 0.1%
   * → 드물다. 드물어서 평균에 묻힌다. 묻히니까 치명적이다.
   *   비율로 보면 안 되고 **건별로 잡아야** 한다.
   */
  async getNegativeAlerts(hospitalId: string, days = 30) {
    const { hospital } = await this.getHospitalContext(hospitalId);
    const sinceDate = this.since(days);

    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: sinceDate }, isMentioned: true },
      select: {
        id: true,
        aiPlatform: true,
        responseText: true,
        sentimentLabel: true,
        sentimentScoreV2: true,
        recommendationDepth: true,
        answerPositionType: true,
        citedSources: true,
        citedUrl: true,
        sourceHints: true,
        responseDate: true,
        createdAt: true,
        archivedPromptText: true,
        prompt: { select: { promptText: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = responses.length;
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    const alerts: any[] = [];
    /** 부정 응답에서 인용된 도메인 = 부정의 출처 후보 (강의록 29번 역추적) */
    const negativeDomains = new Map<string, number>();

    for (const r of responses) {
      const isNegative =
        r.sentimentLabel === 'NEGATIVE' ||
        (r.sentimentScoreV2 !== null && r.sentimentScoreV2 < 0) ||
        r.recommendationDepth === 'R0' ||
        r.answerPositionType === 'NEGATIVE';

      if (isNegative) negative++;
      else if (r.sentimentLabel === 'POSITIVE') positive++;
      else neutral++;

      if (!isNegative) continue;

      // 부정 출처 역추적
      const urls = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];
      const hintDomains: string[] = [];
      if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
        const sources = Array.isArray((r.sourceHints as any)?.sources)
          ? (r.sourceHints as any).sources
          : [];
        for (const s of sources) {
          const real = this.extractRealDomainFromHint(s);
          if (real) hintDomains.push(real);
        }
      }
      const domains = new Set<string>();
      let hintIdx = 0;
      for (const url of urls) {
        let d = this.domainOf(url);
        if (
          r.aiPlatform === 'GEMINI' &&
          url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')
        ) {
          d = hintDomains[hintIdx] || hintDomains[0] || null;
          hintIdx++;
        }
        if (d) domains.add(d);
      }
      for (const d of domains) negativeDomains.set(d, (negativeDomains.get(d) || 0) + 1);

      // 부정 근거 문장 추출 (부정 신호어 주변 1문장)
      const NEG_WORDS =
        /(비싸|비쌌|불친절|아프|아팠|불만|후회|실패|재수술|과잉|바가지|대기|오래 기다|불편|추천하지|권하지|주의|논란|문제)/;
      const sentences = (r.responseText || '')
        .split(/(?<=[.!?。])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const evidence = sentences.filter((s) => NEG_WORDS.test(s)).slice(0, 2);

      alerts.push({
        responseId: r.id,
        platform: r.aiPlatform,
        promptText: r.prompt?.promptText || r.archivedPromptText || null,
        sentimentLabel: r.sentimentLabel,
        sentimentScoreV2: r.sentimentScoreV2,
        recommendationDepth: r.recommendationDepth,
        answerPositionType: r.answerPositionType,
        evidence,
        citedDomains: [...domains].slice(0, 5),
        responseDate: r.responseDate,
        detectedAt: r.createdAt,
        /** 부정 심각도: 낮을수록 심각 */
        severity:
          r.answerPositionType === 'NEGATIVE' || (r.sentimentScoreV2 ?? 0) <= -2
            ? 'CRITICAL'
            : r.recommendationDepth === 'R0'
              ? 'WARNING'
              : 'INFO',
      });
    }

    const rate = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

    const topNegativeSources = [...negativeDomains.entries()]
      .map(([domain, count]) => ({ domain, negativeResponses: count }))
      .sort((a, b) => b.negativeResponses - a.negativeResponses)
      .slice(0, 10);

    return {
      period: `최근 ${days}일`,
      hospitalName: hospital?.name ?? null,
      mentionedResponses: total,
      distribution: {
        positive: { count: positive, rate: rate(positive) },
        neutral: { count: neutral, rate: rate(neutral) },
        negative: { count: negative, rate: rate(negative) },
      },
      benchmark: {
        note: '강의록 실측 벤치마크',
        positive: 88.9,
        neutral: 11.0,
        negative: 0.1,
        source: '강의록 29번',
      },
      /** 건수 기준 경보 — 비율이 낮아도 건이 있으면 무조건 노출 */
      alertCount: alerts.length,
      criticalCount: alerts.filter((a) => a.severity === 'CRITICAL').length,
      alerts: alerts.slice(0, 30),
      topNegativeSources,
      insight:
        negative === 0
          ? '부정 언급 0건입니다. 다만 강의록 29번대로 부정은 0.1% 수준으로 드물게 터지므로, 비율이 아니라 건수로 계속 감시합니다.'
          : `부정 언급 ${negative}건 (${rate(negative)}%). 비율은 작아도 이 답변을 본 환자는 100% 그 문장을 읽습니다.` +
            (topNegativeSources.length > 0
              ? ` 가장 자주 인용된 부정 출처는 ${topNegativeSources[0].domain}(${topNegativeSources[0].negativeResponses}건)입니다 — 여기를 최신·고신뢰 정보로 덮어써야 합니다.`
              : ''),
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 통합 요약 — 대시보드 상단 카드용
  // ═════════════════════════════════════════════════════════════
  async getLectureSummary(hospitalId: string, days = 30) {
    const [efficiency, portfolio, region, director, split, difficulty, negative] =
      await Promise.all([
        this.getCitationEfficiency(hospitalId, days),
        this.getPortfolioMap(hospitalId, days),
        this.getRegionLeverage(hospitalId, days),
        this.getDirectorBranding(hospitalId, days),
        this.getAeoGeoSplit(hospitalId, days),
        this.getDifficultyBreakdown(hospitalId, days),
        this.getNegativeAlerts(hospitalId, days),
      ]);

    const homeBase = portfolio.zones.find((z) => z.zone === 'HOME_BASE');
    const avoid = portfolio.zones.find((z) => z.zone === 'AVOID');

    const cards = [
      {
        key: 'homeBaseShare',
        lectureItem: 2,
        title: '본진(홈페이지·GBP) 비중',
        value: homeBase?.share ?? 0,
        unit: '%',
        status: (homeBase?.share ?? 0) >= 10 ? 'GOOD' : (homeBase?.share ?? 0) > 0 ? 'WARN' : 'BAD',
        note: '강의록 2번 — 홈페이지가 최상위 출처',
      },
      {
        key: 'efficiencyLeader',
        lectureItem: 25,
        title: '문서당 효율 1위 채널',
        value: efficiency.channels[0]?.channelLabel ?? '-',
        unit: '',
        status: 'INFO',
        note: '인용수 ≠ 효율. 역인과 오류 차단 지표',
      },
      {
        key: 'dongLeverage',
        lectureItem: 12,
        title: '동 단위 유리 배율',
        value: region.dongVsSigungu ?? 0,
        unit: '배',
        status:
          region.dongVsSigungu === null
            ? 'INFO'
            : region.dongVsSigungu >= 1.7
              ? 'GOOD'
              : region.dongVsSigungu >= 1
                ? 'WARN'
                : 'BAD',
        note: '강의록 벤치마크 1.7배',
      },
      {
        key: 'realNameRate',
        lectureItem: 20,
        title: '원장 실명 언급률',
        value: director.realNameRate,
        unit: '%',
        status: director.realNameRate >= 5 ? 'GOOD' : director.realNameRate > 0 ? 'WARN' : 'BAD',
        note: '강의록 벤치마크 0.7%',
      },
      {
        key: 'geoPenetration',
        lectureItem: 0,
        title: 'GEO 진입도 (검색 없이 인지)',
        value: split.geo.mentionRate,
        unit: '%',
        status: split.geo.mentionRate > 0 ? 'GOOD' : 'BAD',
        note: 'AEO 단기전 vs GEO 장기전 분리',
      },
      {
        key: 'balancedSov',
        lectureItem: 28,
        title: '착시 보정 SoV',
        value: difficulty.balancedSov,
        unit: '%',
        status:
          Math.abs(difficulty.balancedSov - difficulty.overallSov) <= 10 ? 'GOOD' : 'WARN',
        note: `종합 SoV ${difficulty.overallSov}% (쉬운 질문 ${difficulty.easyShare}%)`,
      },
      {
        key: 'negativeAlerts',
        lectureItem: 29,
        title: '부정 언급 경보',
        value: negative.alertCount,
        unit: '건',
        status: negative.criticalCount > 0 ? 'BAD' : negative.alertCount > 0 ? 'WARN' : 'GOOD',
        note: '비율이 아니라 건수로 감시',
      },
      {
        key: 'avoidShare',
        lectureItem: 32,
        title: "'하지마' 구역 비중",
        value: avoid?.share ?? 0,
        unit: '%',
        status: (avoid?.share ?? 0) < 10 ? 'GOOD' : (avoid?.share ?? 0) < 20 ? 'WARN' : 'BAD',
        note: '지식iN·블로그신규·티스토리신규·PBN',
      },
    ];

    // 모든 경고 통합 (우선순위 순)
    const allWarnings = [
      ...portfolio.warnings.map((w) => ({ lectureItem: 32, message: w })),
      ...difficulty.warnings.map((w) => ({ lectureItem: 28, message: w })),
    ];
    if (negative.criticalCount > 0) {
      allWarnings.unshift({
        lectureItem: 29,
        message: `치명적 부정 언급 ${negative.criticalCount}건이 감지됐습니다. 부정은 드물기 때문에 평균에 묻히지만, 그 답변을 본 환자에게는 100%입니다.`,
      });
    }
    if (director.realNameRate === 0 && director.doctorNameCandidates.length > 0) {
      allWarnings.push({
        lectureItem: 20,
        message: `원장 실명이 AI 답변에 단 한 번도 등장하지 않았습니다. 실명이 엔티티로 학습되지 않은 상태입니다.`,
      });
    }

    return {
      period: `최근 ${days}일`,
      hospitalName: efficiency.hospitalName,
      cards,
      warnings: allWarnings,
      insights: [
        { lectureItem: 25, text: efficiency.insight },
        { lectureItem: 12, text: region.insight },
        { lectureItem: 20, text: director.prescription },
        { lectureItem: 0, text: split.insight },
        { lectureItem: 29, text: negative.insight },
      ],
    };
  }
}
