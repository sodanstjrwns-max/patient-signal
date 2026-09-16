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
import {
  EN_EMAILS,
  EN_LAYOUT,
  EN_PURCHASE_EMAILS,
  EN_PURCHASE_LAYOUT,
} from './emails.en';
import {
  JA_EMAILS,
  JA_LAYOUT,
  JA_PURCHASE_EMAILS,
  JA_PURCHASE_LAYOUT,
} from './emails.ja';

type Lang = 'en' | 'ja';

/** The store's ping (webhook) body, form-encoded; only the fields we read. */
export interface StorePing {
  seller_id?: string;
  sale_id?: string;
  product_permalink?: string;
  permalink?: string;
  email?: string;
  price?: string;
  currency?: string;
  refunded?: string;
  test?: string;
  /** query parameters that were on the product URL at purchase (we add cid/sid) */
  url_params?: Record<string, string>;
}

export interface OfferConfig {
  code: string;
  /** the store prices the Japanese edition in yen, so it may need its own code */
  codeJa: string;
  expires: Date;
  priceEn: string;
  priceJa: string;
}

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

  /**
   * days after sign-up at which step N (1-indexed) goes out:
   * five letters over eight days, the one time-limited price a week after the
   * plain offer, then a column every two weeks.
   */
  private readonly SCHEDULE_DAYS = [0, 2, 4, 6, 8, 15, 29, 43, 57];
  /** days after purchase for the two post-purchase notes */
  private readonly PURCHASE_DAYS = [3, 14];
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
  private purchasePack(lang: Lang): {
    emails: LeadEmail[];
    layout: LayoutStrings;
  } {
    return lang === 'ja'
      ? { emails: JA_PURCHASE_EMAILS, layout: JA_PURCHASE_LAYOUT }
      : { emails: EN_PURCHASE_EMAILS, layout: EN_PURCHASE_LAYOUT };
  }

  private storeUrl(lang: Lang): string {
    return `https://sodanstjrwns.gumroad.com/l/patientfunnel-${lang}`;
  }

  // ───────────────────────────────── offer ───────────────────────────────────

  /**
   * The one time-limited price. Configured entirely by environment so the code
   * can be rotated without a deploy; while unset or past its date the offer
   * letter is skipped and the sequence continues.
   */
  static offerFrom(
    env: NodeJS.ProcessEnv,
    now: Date = new Date(),
  ): OfferConfig | null {
    const code = env.GUMROAD_OFFER_CODE?.trim();
    const exp = env.GUMROAD_OFFER_EXPIRES?.trim();
    const priceEn = env.GUMROAD_OFFER_PRICE_EN?.trim();
    const priceJa = env.GUMROAD_OFFER_PRICE_JA?.trim();
    if (!code || !exp || !priceEn || !priceJa) return null;
    // the date is inclusive: valid through the end of that day (UTC)
    const expires = new Date(`${exp}T23:59:59Z`);
    if (Number.isNaN(expires.getTime()) || now > expires) return null;
    const codeJa = env.GUMROAD_OFFER_CODE_JA?.trim() || code;
    return { code, codeJa, expires, priceEn, priceJa };
  }

  private offerText(lang: Lang): Record<string, string> | null {
    const o = LeadMagnetService.offerFrom(process.env);
    if (!o) return null;
    const expires =
      lang === 'ja'
        ? `${o.expires.getUTCFullYear()}年${o.expires.getUTCMonth() + 1}月${o.expires.getUTCDate()}日`
        : o.expires.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          });
    const code = lang === 'ja' ? o.codeJa : o.code;
    return {
      '{{offer_code}}': code,
      '{{offer_price}}': lang === 'ja' ? o.priceJa : o.priceEn,
      '{{offer_expires}}': expires,
      // the store applies a code given as the last path segment
      '{{offer_url}}': `${this.storeUrl(lang)}/${encodeURIComponent(code)}`,
    };
  }

  /** Which edition a store permalink refers to; null for anything else. */
  static languageFromPermalink(
    ...candidates: Array<string | undefined>
  ): Lang | null {
    for (const c of candidates) {
      const v = (c || '').toLowerCase();
      if (v.includes('patientfunnel-ja')) return 'ja';
      if (v.includes('patientfunnel-en')) return 'en';
    }
    return null;
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
    await this.notifyOwner(
      `[Patient Funnel] New lead · ${language.toUpperCase()}`,
      `New free-edition request: ${email} · ${language} · source ${dto.source?.trim() || '-'}. Sequence starts today.`,
    );
    return { ok: true };
  }

  async unsubscribe(token: string): Promise<string> {
    let row: {
      id: string;
      email: string;
      language: string;
      unsubscribedAt: Date | null;
    } | null = token
      ? await this.prisma.leadMagnet.findUnique({ where: { token } })
      : null;
    if (row) {
      if (!row.unsubscribedAt) {
        await this.prisma.leadMagnet.update({
          where: { id: row.id },
          data: { unsubscribedAt: new Date() },
        });
        this.logger.log(`[lead-magnet] unsubscribed ${row.email}`);
      }
    } else if (token) {
      // the same link works for the post-purchase notes
      row = await this.prisma.bookPurchase.findUnique({ where: { token } });
      if (row && !row.unsubscribedAt) {
        await this.prisma.bookPurchase.update({
          where: { id: row.id },
          data: { unsubscribedAt: new Date() },
        });
        this.logger.log(`[lead-magnet] purchaser unsubscribed ${row.email}`);
      }
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

    const offer = tpl.offer ? this.offerText(language) : null;
    if (tpl.offer && !offer) {
      // no live offer: the letter is dropped, the sequence moves on
      if (advance) {
        await this.prisma.leadMagnet.update({
          where: { id },
          data: { step, lastSentAt: new Date() },
        });
      }
      this.logger.log(
        `[lead-magnet] step ${step} skipped for ${to} (no offer)`,
      );
      return true;
    }

    const fill = (p: string): string => {
      let out = p === '{{download}}' ? this.downloadUrl(language) : p;
      for (const [k, v] of Object.entries(offer ?? {}))
        out = out.split(k).join(v);
      return out;
    };
    const ok = await this.deliver(
      to,
      { subject: fill(tpl.subject), body: tpl.body.map(fill) },
      layout,
      token,
    );
    if (!ok) {
      this.logger.warn(`[lead-magnet] step ${step} to ${to} failed`);
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

  private async deliver(
    to: string,
    email: LeadEmail,
    layout: LayoutStrings,
    token: string,
  ): Promise<boolean> {
    const html = renderLeadEmail(email, layout, this.unsubscribeUrl(token));
    const sent = await this.email.sendHtmlEmail({
      to,
      subject: email.subject,
      html,
      fromName: 'The Patient Funnel',
      fromEmail: this.fromEmail,
      replyTo:
        process.env.INTL_CHECK_REPLY_TO?.trim() || 'patientsfunnel@gmail.com',
    });
    if (!sent.ok) {
      this.logger.warn(
        `[lead-magnet] send to ${to} failed: ${sent.error ?? 'unknown'}`,
      );
    }
    return sent.ok;
  }

  // ───────────────────────────────── notify / analytics ─────────────────────

  /** One-line heads-up to the owner so replies and sales get a human response. */
  private async notifyOwner(subject: string, line: string): Promise<void> {
    const to =
      process.env.LEAD_MAGNET_NOTIFY?.trim() || 'patientsfunnel@gmail.com';
    try {
      await this.email.sendHtmlEmail({
        to,
        subject,
        html: `<p style="font-family:system-ui,sans-serif;font-size:15px">${line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</p>`,
        fromName: 'The Patient Funnel',
        fromEmail: this.fromEmail,
      });
    } catch (e) {
      this.logger.warn(
        `[lead-magnet] owner notify failed: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Server-side GA4 event for a store sale (Measurement Protocol). The client id
   * and session id come from the query string track.js appends to the store
   * link, so the purchase lands in the same session as the ad click and Ads can
   * learn from sales, not just leads. Without GA4_API_SECRET this is a no-op.
   */
  private async ga4Event(
    name: 'purchase' | 'refund',
    ping: StorePing,
    language: Lang,
    saleId: string,
    priceCents: number,
    currency: string,
  ): Promise<void> {
    const secret = process.env.GA4_API_SECRET?.trim();
    const mid = process.env.GA4_MEASUREMENT_ID?.trim() || 'G-JKY5HYYKTB';
    if (!secret) return;
    const cid = ping.url_params?.cid?.trim();
    const sid = ping.url_params?.sid?.trim();
    // a sale we cannot tie to a browser still counts, under a stable synthetic id
    const clientId =
      cid && /^[\w.-]{4,64}$/.test(cid)
        ? cid
        : `srv.${createHash('sha256')
            .update(ping.email || saleId)
            .digest('hex')
            .slice(0, 16)}`;
    const value = Math.round(priceCents) / 100;
    const params: Record<string, unknown> = {
      transaction_id: saleId,
      value,
      currency: currency.toUpperCase(),
      items: [
        {
          item_id: `patientfunnel-${language}`,
          item_name: `Patient Funnel (${language})`,
          price: value,
          quantity: 1,
        },
      ],
      engagement_time_msec: 1,
      source_channel: 'gumroad-ping',
    };
    if (sid && /^\d{6,20}$/.test(sid)) params.session_id = sid;
    try {
      const res = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(mid)}&api_secret=${encodeURIComponent(secret)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            events: [{ name, params }],
          }),
        },
      );
      this.logger.log(
        `[lead-magnet] ga4 ${name} ${saleId} → ${res.status}${cid ? '' : ' (no cid; unattributed)'}`,
      );
    } catch (e) {
      this.logger.warn(
        `[lead-magnet] ga4 ${name} failed: ${(e as Error).message}`,
      );
    }
  }

  // ───────────────────────────────── purchases ──────────────────────────────

  /**
   * The store pings this on every sale (form-encoded, unsigned). The seller id
   * is the only authentication the store offers, so it is required: with the
   * variable unset the id seen is logged and nothing is written, which is how
   * the value is discovered on the first test ping.
   */
  async recordSale(
    ping: StorePing,
  ): Promise<{ ok: boolean; ignored?: string }> {
    const expected = process.env.GUMROAD_SELLER_ID?.trim();
    if (!expected) {
      this.logger.warn(
        `[lead-magnet] store ping refused: GUMROAD_SELLER_ID unset (seen seller_id=${ping.seller_id ?? '-'})`,
      );
      throw new HttpException(
        { code: 'NOT_CONFIGURED', message: 'Store pings are not enabled.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if ((ping.seller_id || '') !== expected) {
      throw new HttpException(
        { code: 'FORBIDDEN', message: 'Unknown seller.' },
        HttpStatus.FORBIDDEN,
      );
    }
    const language = LeadMagnetService.languageFromPermalink(
      ping.product_permalink,
      ping.permalink,
    );
    if (!language) return { ok: true, ignored: 'other product' };
    const email = (ping.email || '').trim().toLowerCase();
    const saleId = (ping.sale_id || '').trim();
    if (!email || !saleId) return { ok: true, ignored: 'no email or sale id' };
    if (ping.test === 'true') {
      this.logger.log(
        `[lead-magnet] store test ping ok (${language}, ${email})`,
      );
      return { ok: true, ignored: 'test' };
    }
    const refunded = ping.refunded === 'true';
    const priceCents = parseInt(ping.price || '0', 10) || 0;

    await this.prisma.bookPurchase.upsert({
      where: { saleId },
      create: {
        email,
        language,
        saleId,
        productPermalink: (
          ping.product_permalink ||
          ping.permalink ||
          ''
        ).slice(0, 300),
        priceCents,
        currency: (ping.currency || 'usd').toLowerCase().slice(0, 8),
        refunded,
        token: randomUUID(),
        step: 0,
      },
      update: { refunded },
    });
    if (!refunded) {
      // a buyer leaves the sales sequence, in every language they signed up in
      await this.prisma.leadMagnet.updateMany({
        where: { email, purchasedAt: null },
        data: { purchasedAt: new Date() },
      });
    }
    this.logger.log(
      `[lead-magnet] sale ${saleId} ${refunded ? 'refunded' : 'recorded'} (${language}, ${email})`,
    );
    const money = `${(priceCents / 100).toFixed(2)} ${(ping.currency || 'usd').toUpperCase()}`;
    await this.ga4Event(
      refunded ? 'refund' : 'purchase',
      ping,
      language,
      saleId,
      priceCents,
      ping.currency || 'usd',
    );
    await this.notifyOwner(
      refunded
        ? `[Patient Funnel] Refund · ${language.toUpperCase()} · ${money}`
        : `[Patient Funnel] Sale · ${language.toUpperCase()} · ${money}`,
      `${refunded ? 'Refunded' : 'New sale'}: ${email} · ${money} · ${language} · sale ${saleId}. Post-purchase notes go out on day 3 and day 14.`,
    );
    return { ok: true };
  }

  private async runPurchaseSequence(
    now: number,
  ): Promise<{ sent: number; failed: number }> {
    const rows = await this.prisma.bookPurchase.findMany({
      where: {
        unsubscribedAt: null,
        refunded: false,
        step: { lt: this.PURCHASE_DAYS.length },
      },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize,
    });
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      if (!LeadMagnetService.isSendable(row.email)) continue;
      const next = row.step + 1;
      const dueAt =
        row.createdAt.getTime() +
        this.PURCHASE_DAYS[next - 1] * 24 * 60 * 60 * 1000;
      if (now < dueAt) continue;
      const lang: Lang = row.language === 'ja' ? 'ja' : 'en';
      const { emails, layout } = this.purchasePack(lang);
      const tpl = emails[next - 1];
      if (!tpl) continue;
      const ok = await this.deliver(row.email, tpl, layout, row.token);
      if (ok) {
        await this.prisma.bookPurchase.update({
          where: { id: row.id },
          data: { step: next, lastSentAt: new Date() },
        });
        this.logger.log(`[lead-magnet] purchase step ${next} → ${row.email}`);
        sent++;
      } else failed++;
    }
    return { sent, failed };
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
        purchasedAt: null,
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
    const p = await this.runPurchaseSequence(now);
    sent += p.sent;
    failed += p.failed;
    if (sent || failed) {
      this.logger.log(
        `[lead-magnet] sequence run: sent ${sent}, failed ${failed}`,
      );
    }
    return { sent, failed };
  }
}
