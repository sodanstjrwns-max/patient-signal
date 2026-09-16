import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AICrawlerService } from '../ai-crawler/ai-crawler.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  aggregateResults,
  INTL_PLATFORMS,
  type IntlCheckResult,
  type IntlObservation,
  type IntlPlatform,
  type IntlQuestionResult,
} from './analysis';
import { CreateIntlCheckDto } from './dto/create-intl-check.dto';
import { detectMention, extractClinicNames, extractDomains } from './mention';
import { generateQuestions, normalizeSpecialty } from './question-generator';
import { renderReportEn, subjectEn } from './report.en';
import { renderReportJa, subjectJa } from './report.ja';
import type { IntlLanguage } from './templates.types';

/**
 * International AI Visibility Check (lead magnet for thepatientfunnel.com/en|jp/check)
 *
 * - Anonymous POST → row in `intl_checks` → 202 { id } → background run
 * - 20 questions × up to 4 platforms (ChatGPT / Gemini / Perplexity / Claude),
 *   reusing AICrawlerService.queryPlatformPublic (same strategies, model ladder,
 *   retry + circuit breaker as the Korean crawler). Naver / CLOVA X / Grok are
 *   never used here.
 * - Result JSON persisted, report e-mailed via Resend in the requested language.
 *
 * Isolation from Korean customers: separate table, no hospital/prompt rows, no
 * cron, no cache invalidation. Shared resources are only the provider API keys
 * (cost) and the crawler's per-platform circuit breaker — a platform is dropped
 * for the rest of a run after INTL_CHECK_PLATFORM_FAIL_CAP consecutive failures
 * so one broken run cannot trip the breaker used by the daily crawl.
 */
@Injectable()
export class IntlCheckService implements OnModuleInit {
  private readonly logger = new Logger(IntlCheckService.name);

  /** per-email and per-IP submissions allowed per rolling 24h */
  private readonly PER_KEY_DAILY_LIMIT = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawler: AICrawlerService,
    private readonly email: EmailService,
  ) {}

  // ───────────────────────── configuration (env, all optional) ─────────────────────────

  private get globalDailyCap(): number {
    return this.envInt('INTL_CHECK_DAILY_CAP', 50);
  }
  private get concurrency(): number {
    return Math.max(1, Math.min(8, this.envInt('INTL_CHECK_CONCURRENCY', 4)));
  }
  private get deadlineMs(): number {
    return this.envInt('INTL_CHECK_DEADLINE_MS', 170_000);
  }
  /**
   * A run is considered dead this long after it started. The worker pool itself
   * stops at deadlineMs, so anything still RUNNING past deadline + margin lost
   * its process (deploy restart, OOM) and will never finish or e-mail.
   */
  private get staleAfterMs(): number {
    return this.deadlineMs + this.envInt('INTL_CHECK_STALE_MARGIN_MS', 300_000);
  }
  /** An interrupted run this young is re-run at boot (the visitor is still waiting). */
  private get resumeWindowMs(): number {
    return this.envInt('INTL_CHECK_RESUME_WINDOW_MS', 30 * 60_000);
  }
  /** Hard cap on runs resumed per boot, so a restart loop cannot multiply LLM spend. */
  private get resumeMax(): number {
    return Math.max(0, this.envInt('INTL_CHECK_RESUME_MAX', 3));
  }
  private get platformFailCap(): number {
    return Math.max(1, this.envInt('INTL_CHECK_PLATFORM_FAIL_CAP', 3));
  }
  private get replyTo(): string {
    return (
      process.env.INTL_CHECK_REPLY_TO?.trim() || 'patientsfunnel@gmail.com'
    );
  }
  private envInt(name: string, fallback: number): number {
    const n = parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /** Platforms to use: INTL_CHECK_PLATFORMS (csv) ∩ supported, minus those without keys. */
  private resolvePlatforms(): { used: IntlPlatform[]; unavailable: string[] } {
    const wanted = (process.env.INTL_CHECK_PLATFORMS || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) as IntlPlatform[];
    const candidates =
      wanted.length > 0
        ? INTL_PLATFORMS.filter((p) => wanted.includes(p))
        : INTL_PLATFORMS;
    const missing = this.crawler.getUnavailablePlatforms(candidates);
    const missingSet = new Set(missing.map((m) => m.platform));
    return {
      used: candidates.filter((p) => !missingSet.has(p)),
      unavailable: missing.map((m) => `${m.platform} (${m.reason})`),
    };
  }

  // ───────────────────────────────── submit / status ─────────────────────────────────

  static hashIp(ip: string | undefined | null): string | null {
    const raw = (ip || '').trim();
    if (!raw) return null;
    const salt = process.env.INTL_CHECK_IP_SALT || '';
    return createHash('sha256')
      .update(`${salt}${raw}`)
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Boot sweep: a deploy or crash kills in-flight runs and leaves their rows
   * RUNNING forever (the visitor's page would poll until they give up). Mark
   * those FAILED once at startup so the page can show an error and offer a retry.
   */
  async onModuleInit(): Promise<void> {
    try {
      const now = Date.now();
      // Recent enough that the visitor is still waiting for the e-mail they
      // asked for → resume it. Older than that → give up and mark it failed.
      const resumable = await this.prisma.intlCheck.findMany({
        where: {
          status: { in: ['PENDING', 'RUNNING'] },
          createdAt: {
            lt: new Date(now - this.staleAfterMs),
            gte: new Date(now - this.resumeWindowMs),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: this.resumeMax,
        select: { id: true },
      });

      const { count } = await this.prisma.intlCheck.updateMany({
        where: {
          status: { in: ['PENDING', 'RUNNING'] },
          createdAt: { lt: new Date(now - this.staleAfterMs) },
          id: { notIn: resumable.map((r) => r.id) },
        },
        data: {
          status: 'FAILED',
          errorMessage: 'Interrupted (server restarted during the run).',
        },
      });
      if (count > 0) {
        this.logger.warn(
          `[intl-check] boot sweep: ${count} interrupted run(s) marked FAILED`,
        );
      }

      if (resumable.length > 0) {
        // Reset to PENDING so run() (which refuses to touch a RUNNING row) restarts them.
        await this.prisma.intlCheck.updateMany({
          where: { id: { in: resumable.map((r) => r.id) } },
          data: { status: 'PENDING', errorMessage: null },
        });
        this.logger.warn(
          `[intl-check] boot sweep: resuming ${resumable.length} interrupted run(s)`,
        );
        for (const r of resumable) this.schedule(r.id);
      }
    } catch (err: unknown) {
      this.logger.warn(
        `[intl-check] boot sweep skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async submit(dto: CreateIntlCheckDto, ip?: string): Promise<{ id: string }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const email = dto.email.trim().toLowerCase();
    const ipHash = IntlCheckService.hashIp(ip);

    const [byEmail, byIp, total] = await Promise.all([
      // A run that crashed never produced a report, so it must not eat the
      // visitor's daily quota (or the global cap).
      this.prisma.intlCheck.count({
        where: { email, createdAt: { gte: since }, status: { not: 'FAILED' } },
      }),
      ipHash
        ? this.prisma.intlCheck.count({
            where: {
              ipHash,
              createdAt: { gte: since },
              status: { not: 'FAILED' },
            },
          })
        : Promise.resolve(0),
      this.prisma.intlCheck.count({
        where: { createdAt: { gte: since }, status: { not: 'FAILED' } },
      }),
    ]);

    if (
      byEmail >= this.PER_KEY_DAILY_LIMIT ||
      byIp >= this.PER_KEY_DAILY_LIMIT
    ) {
      throw new HttpException(
        {
          code: 'DAILY_LIMIT',
          message: `Limit of ${this.PER_KEY_DAILY_LIMIT} checks per day reached. Please try again tomorrow.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (total >= this.globalDailyCap) {
      throw new HttpException(
        {
          code: 'CAPACITY',
          message: 'We are at capacity for today. Please try again tomorrow.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const row = await this.prisma.intlCheck.create({
      data: {
        email,
        clinicName: dto.clinicName.trim(),
        city: dto.city.trim(),
        country: dto.country.trim().toUpperCase(),
        language: dto.language === 'ja' ? 'ja' : 'en',
        website: dto.website?.trim() || null,
        specialty: normalizeSpecialty(dto.specialty),
        ipHash,
        status: 'PENDING',
      },
      select: { id: true },
    });

    this.schedule(row.id);
    return { id: row.id };
  }

  async getStatus(id: string) {
    const row = await this.prisma.intlCheck.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        clinicName: true,
        city: true,
        country: true,
        language: true,
        specialty: true,
        resultJson: true,
        emailedAt: true,
      },
    });
    if (!row) throw new NotFoundException('Check not found');

    // Lazy recovery: the run's process is gone (deploy restart, crash) but the
    // row still says RUNNING. Tell the poller it failed instead of spinning.
    const { status: rowStatus, ...restRow } = row;
    let status: string = rowStatus;
    let errorMessage: string | null = null;
    if (
      (status === 'PENDING' || status === 'RUNNING') &&
      Date.now() - row.createdAt.getTime() > this.staleAfterMs
    ) {
      status = 'FAILED';
      errorMessage = 'Interrupted (server restarted during the run).';
      this.logger.warn(`[intl-check ${id}] stale run → FAILED`);
      await this.prisma.intlCheck
        .update({
          where: { id },
          data: { status, errorMessage },
        })
        .catch(() => undefined);
    }

    const { resultJson, ...rest } = restRow;
    return {
      ...rest,
      status,
      errorMessage,
      emailed: !!row.emailedAt,
      result:
        status === 'DONE' ? (resultJson as unknown as IntlCheckResult) : null,
    };
  }

  // ───────────────────────────────── background run ─────────────────────────────────

  /** Fire-and-forget with error capture (no Bull queue: this must not touch the crawl queue). */
  private schedule(id: string): void {
    setImmediate(() => {
      this.run(id).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`[intl-check ${id}] run failed: ${message}`);
        await this.prisma.intlCheck
          .update({
            where: { id },
            data: { status: 'FAILED', errorMessage: message.slice(0, 500) },
          })
          .catch(() => undefined);
      });
    });
  }

  async run(id: string): Promise<void> {
    const startedAt = Date.now();
    const row = await this.prisma.intlCheck.findUnique({ where: { id } });
    if (!row) throw new Error('row not found');
    if (row.status === 'DONE' || row.status === 'RUNNING') return;

    await this.prisma.intlCheck.update({
      where: { id },
      data: { status: 'RUNNING', errorMessage: null },
    });

    const language: IntlLanguage = row.language === 'ja' ? 'ja' : 'en';
    const questions = generateQuestions({
      clinicName: row.clinicName,
      city: row.city,
      country: row.country,
      language,
      specialty: row.specialty,
    });
    const { used: platforms, unavailable } = this.resolvePlatforms();
    this.logger.log(
      `[intl-check ${id}] start "${row.clinicName}" (${row.city}/${row.country}/${language}) ` +
        `${questions.length}q × [${platforms.join(',')}]${unavailable.length ? ` · unavailable: ${unavailable.join('; ')}` : ''}`,
    );

    const results: IntlQuestionResult[] = questions.map((q) => ({
      key: q.key,
      intent: q.intent,
      branded: q.branded,
      text: q.text,
      observations: [],
    }));

    // Task list: platform-major so a slow platform does not starve the others.
    type Task = { qi: number; platform: IntlPlatform };
    const tasks: Task[] = [];
    for (let qi = 0; qi < questions.length; qi++) {
      for (const platform of platforms) tasks.push({ qi, platform });
    }

    const deadline = startedAt + this.deadlineMs;
    const consecutiveFailures = new Map<IntlPlatform, number>();
    const disabled = new Set<IntlPlatform>();
    let cursor = 0;

    const runOne = async (task: Task): Promise<void> => {
      const q = questions[task.qi];
      const target = results[task.qi].observations;
      if (Date.now() > deadline) {
        target.push(this.skipped(task.platform, 'deadline'));
        return;
      }
      if (disabled.has(task.platform)) {
        target.push(this.skipped(task.platform, 'platform_disabled'));
        return;
      }
      try {
        const r = await this.crawler.queryPlatformPublic(
          task.platform,
          q.text,
          row.clinicName,
        );
        const text = r.response || '';
        const mention = detectMention(text, row.clinicName);
        target.push({
          platform: task.platform,
          ok: true,
          mentioned: mention.mentioned,
          matchedBy: mention.matchedBy,
          isWebSearch: r.isWebSearch,
          model: r.model,
          competitors: extractClinicNames(text, row.clinicName, language, 15),
          domains: extractDomains(r.sourceHints?.sources, r.citedSources, text),
          excerpt: text.slice(0, 300),
        });
        consecutiveFailures.set(task.platform, 0);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[intl-check ${id}] ${task.platform} q=${q.key} failed: ${message}`,
        );
        target.push({
          platform: task.platform,
          ok: false,
          error: message.slice(0, 200),
          mentioned: false,
          competitors: [],
          domains: [],
        });
        const n = (consecutiveFailures.get(task.platform) ?? 0) + 1;
        consecutiveFailures.set(task.platform, n);
        if (n >= this.platformFailCap) {
          disabled.add(task.platform);
          this.logger.warn(
            `[intl-check ${id}] ${task.platform} disabled for this run after ${n} consecutive failures`,
          );
        }
      }
    };

    const worker = async (): Promise<void> => {
      while (cursor < tasks.length) {
        const task = tasks[cursor++];
        await runOne(task);
      }
    };
    await Promise.all(Array.from({ length: this.concurrency }, () => worker()));

    // keep observation order stable (platform order) for the report
    for (const r of results) {
      r.observations.sort(
        (a, b) => platforms.indexOf(a.platform) - platforms.indexOf(b.platform),
      );
    }

    const result = aggregateResults({
      clinicName: row.clinicName,
      city: row.city,
      country: row.country,
      language,
      specialty: row.specialty,
      website: row.website,
      platformsUsed: platforms,
      platformsUnavailable: unavailable,
      questions: results,
      durationMs: Date.now() - startedAt,
    });

    await this.prisma.intlCheck.update({
      where: { id },
      data: {
        status: 'DONE',
        resultJson: result as unknown as Prisma.InputJsonValue,
      },
    });
    this.logger.log(
      `[intl-check ${id}] done in ${Math.round(result.durationMs / 1000)}s — ` +
        `rate ${result.overall.rate ?? 'n/a'}% (${result.overall.mentioned}/${result.overall.answered}, asked ${result.overall.asked})`,
    );

    await this.sendReport(id, row.email, result);
  }

  private skipped(platform: IntlPlatform, reason: string): IntlObservation {
    return {
      platform,
      ok: false,
      error: reason,
      mentioned: false,
      competitors: [],
      domains: [],
    };
  }

  private async sendReport(
    id: string,
    to: string,
    result: IntlCheckResult,
  ): Promise<void> {
    const ja = result.language === 'ja';
    const subject = ja
      ? subjectJa(result.clinicName)
      : subjectEn(result.clinicName);
    const html = ja ? renderReportJa(result) : renderReportEn(result);
    const sent = await this.email.sendHtmlEmail({
      to,
      subject,
      html,
      fromName: 'The Patient Funnel',
      // Own domain once INTL_FROM_EMAIL is set (after the provider verifies it);
      // unset falls back to the account default so mail never stops.
      fromEmail: process.env.INTL_FROM_EMAIL?.trim() || undefined,
      replyTo: this.replyTo,
    });
    if (sent.ok) {
      await this.prisma.intlCheck.update({
        where: { id },
        data: { emailedAt: new Date() },
      });
      this.logger.log(
        `[intl-check ${id}] report e-mailed (${result.language})`,
      );
    } else {
      this.logger.warn(
        `[intl-check ${id}] report e-mail not sent: ${sent.error ?? 'unknown'}`,
      );
      await this.prisma.intlCheck.update({
        where: { id },
        data: {
          errorMessage: `email: ${(sent.error ?? 'not sent').slice(0, 480)}`,
        },
      });
    }
  }
}
