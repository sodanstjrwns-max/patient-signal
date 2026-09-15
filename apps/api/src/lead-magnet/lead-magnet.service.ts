import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash, randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import {
  renderLeadEmail,
  type LayoutStrings,
  type LeadEmail,
} from './email.layout';
import { EN_EMAILS, EN_LAYOUT } from './emails.en';
import { JA_EMAILS, JA_LAYOUT } from './emails.ja';

type Lang = 'en' | 'ja';

/**
 * Free-preview lead magnet for thepatientfunnel.com.
 *
 * The e-mail list lives here rather than in the store: the visitor gives us an
 * address on our own page, gets the PDF immediately, and then receives four
 * more letters on days 2, 4, 6 and 8. Sending is our own (Resend), so nothing
 * depends on the store's workflow limits.
 *
 * Isolation from Korean customers: separate table, no hospital rows, its own
 * daily cron that only touches `lead_magnets`.
 */
@Injectable()
export class LeadMagnetService {
  private readonly logger = new Logger(LeadMagnetService.name);

  /** days after sign-up at which step N (1-indexed) goes out */
  private readonly SCHEDULE_DAYS = [0, 2, 4, 6, 8];
  private readonly PER_KEY_DAILY_LIMIT = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  private get siteUrl(): string {
    return (
      process.env.LEAD_MAGNET_SITE_URL?.trim() || 'https://thepatientfunnel.com'
    );
  }
  private get apiUrl(): string {
    return (
      process.env.LEAD_MAGNET_API_URL?.trim() || 'https://api.patientsignal.kr'
    );
  }
  /**
   * The international book should send from its own domain so its reputation is
   * not mixed with the Korean SaaS transactional mail on patientsignal.kr.
   * Set INTL_FROM_EMAIL once that domain is verified with the provider; while it
   * is unset, EmailService falls back to the account default so mail never stops.
   */
  private get fromEmail(): string | undefined {
    return process.env.INTL_FROM_EMAIL?.trim() || undefined;
  }
  private get batchSize(): number {
    const n = parseInt(process.env.LEAD_MAGNET_BATCH ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  private downloadUrl(lang: Lang): string {
    const env =
      lang === 'ja'
        ? process.env.LEAD_MAGNET_PDF_JA
        : process.env.LEAD_MAGNET_PDF_EN;
    if (env?.trim()) return env.trim();
    const file =
      lang === 'ja'
        ? 'PatientFunnel_ja_preview.pdf'
        : 'PatientFunnel_en_preview.pdf';
    return `${this.siteUrl}/dl/${file}`;
  }

  private unsubscribeUrl(token: string): string {
    return `${this.apiUrl}/api/public/lead-magnet/unsubscribe?t=${token}`;
  }

  private pack(lang: Lang): { emails: LeadEmail[]; layout: LayoutStrings } {
    return lang === 'ja'
      ? { emails: JA_EMAILS, layout: JA_LAYOUT }
      : { emails: EN_EMAILS, layout: EN_LAYOUT };
  }

  /**
   * Reserved / non-deliverable domains (RFC 2606 and friends). Sending to these
   * only produces bounces, which cost us sender reputation, so they never enter
   * the sequence and are skipped if a row already exists.
   */
  private static readonly UNDELIVERABLE =
    /(^|@)(localhost|.*\.(test|invalid|example|localhost)|example\.(com|net|org))$/i;

  static isSendable(email: string): boolean {
    const at = email.lastIndexOf('@');
    if (at < 1) return false;
    return !LeadMagnetService.UNDELIVERABLE.test(email.slice(at + 1));
  }

  static hashIp(ip: string | undefined | null): string | null {
    const raw = (ip || '').trim();
    if (!raw) return null;
    const salt = process.env.INTL_CHECK_IP_SALT || '';
    return createHash('sha256')
      .update(`${salt}${raw}`)
      .digest('hex')
      .slice(0, 32);
  }

  // ───────────────────────────────── sign-up ─────────────────────────────────

  async submit(dto: CreateLeadDto, ip?: string): Promise<{ ok: true }> {
    const email = dto.email.trim().toLowerCase();
    if (!LeadMagnetService.isSendable(email)) {
      throw new HttpException(
        { code: 'UNDELIVERABLE', message: 'That address cannot receive mail.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const language: Lang = dto.language === 'ja' ? 'ja' : 'en';
    const ipHash = LeadMagnetService.hashIp(ip);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (ipHash) {
      const recent = await this.prisma.leadMagnet.count({
        where: { ipHash, createdAt: { gte: since } },
      });
      if (recent >= this.PER_KEY_DAILY_LIMIT) {
        throw new HttpException(
          { code: 'DAILY_LIMIT', message: 'Too many requests today.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const existing = await this.prisma.leadMagnet.findFirst({
      where: { email, language },
    });

    // Asking again just re-sends the download; it never restarts the sequence
    // and it never silently reactivates someone who unsubscribed.
    if (existing) {
      if (existing.unsubscribedAt) {
        this.logger.log(`[lead-magnet] re-request from unsubscribed ${email}`);
        return { ok: true };
      }
      await this.sendStep(
        existing.id,
        email,
        language,
        existing.token,
        1,
        false,
      );
      return { ok: true };
    }

    const row = await this.prisma.leadMagnet.create({
      data: {
        email,
        language,
        source: dto.source?.trim() || null,
        ipHash,
        token: randomUUID(),
        step: 0,
      },
      select: { id: true, token: true },
    });
    this.logger.log(`[lead-magnet] new lead ${email} (${language})`);
    await this.sendStep(row.id, email, language, row.token, 1, true);
    return { ok: true };
  }

  async unsubscribe(token: string): Promise<string> {
    const row = token
      ? await this.prisma.leadMagnet.findUnique({ where: { token } })
      : null;
    if (row && !row.unsubscribedAt) {
      await this.prisma.leadMagnet.update({
        where: { id: row.id },
        data: { unsubscribedAt: new Date() },
      });
      this.logger.log(`[lead-magnet] unsubscribed ${row.email}`);
    }
    const ja = row?.language === 'ja';
    const msg = ja
      ? '配信を停止しました。今後このシリーズのメールは届きません。'
      : 'You are unsubscribed. You will not receive any further emails in this series.';
    return `<!doctype html><html lang="${ja ? 'ja' : 'en'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Patient Funnel</title></head>
<body style="margin:0;background:#f6f5f2;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:520px;margin:12vh auto;padding:0 20px;color:#1a1a1a">
<p style="font-size:17px;line-height:1.7">${msg}</p>
<p style="font-size:14px"><a href="${this.siteUrl}/${ja ? 'jp' : 'en'}/" style="color:#0b6b5e">thepatientfunnel.com</a></p>
</div></body></html>`;
  }

  // ───────────────────────────────── sending ─────────────────────────────────

  /** Sends step N (1-indexed). `advance` guards re-sends of step 1. */
  private async sendStep(
    id: string,
    to: string,
    language: Lang,
    token: string,
    step: number,
    advance: boolean,
  ): Promise<boolean> {
    const { emails, layout } = this.pack(language);
    const tpl = emails[step - 1];
    if (!tpl) return false;

    const body = tpl.body.map((p) =>
      p === '{{download}}' ? this.downloadUrl(language) : p,
    );
    const html = renderLeadEmail(
      { subject: tpl.subject, body },
      layout,
      this.unsubscribeUrl(token),
    );

    const sent = await this.email.sendHtmlEmail({
      to,
      subject: tpl.subject,
      html,
      fromName: 'The Patient Funnel',
      fromEmail: this.fromEmail,
      replyTo:
        process.env.INTL_CHECK_REPLY_TO?.trim() || 'patientsfunnel@gmail.com',
    });

    if (!sent.ok) {
      this.logger.warn(
        `[lead-magnet] step ${step} to ${to} failed: ${sent.error ?? 'unknown'}`,
      );
      return false;
    }
    if (advance) {
      await this.prisma.leadMagnet.update({
        where: { id },
        data: { step, lastSentAt: new Date() },
      });
    }
    this.logger.log(`[lead-magnet] step ${step} → ${to}`);
    return true;
  }

  /**
   * Daily at 09:00 KST: send whichever step is now due for each live lead.
   * One step per lead per run, so a backlog never floods a single inbox.
   */
  @Cron('0 0 * * *', { name: 'lead-magnet-sequence' })
  async runSequence(): Promise<{ sent: number; failed: number }> {
    const now = Date.now();
    const leads = await this.prisma.leadMagnet.findMany({
      where: {
        unsubscribedAt: null,
        step: { gte: 1, lt: this.SCHEDULE_DAYS.length },
      },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize,
    });

    let sent = 0;
    let failed = 0;
    for (const lead of leads) {
      if (!LeadMagnetService.isSendable(lead.email)) continue;
      const next = lead.step + 1;
      const dueAt =
        lead.createdAt.getTime() +
        this.SCHEDULE_DAYS[next - 1] * 24 * 60 * 60 * 1000;
      if (now < dueAt) continue;
      const ok = await this.sendStep(
        lead.id,
        lead.email,
        lead.language === 'ja' ? 'ja' : 'en',
        lead.token,
        next,
        true,
      );
      if (ok) sent++;
      else failed++;
    }
    if (sent || failed) {
      this.logger.log(
        `[lead-magnet] sequence run: sent ${sent}, failed ${failed}`,
      );
    }
    return { sent, failed };
  }
}
