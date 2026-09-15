/**
 * International AI Visibility Check — shared HTML e-mail layout.
 * Language-specific strings live in report.en.ts / report.ja.ts.
 */
import type { IntlCheckResult } from './analysis';

export interface ReportStrings {
  lang: 'en' | 'ja';
  htmlLang: string;
  fontFamily: string;
  preheader: (r: IntlCheckResult) => string;
  title: string;
  subtitle: (r: IntlCheckResult) => string;
  scoreLabel: string;
  scoreCaption: (r: IntlCheckResult) => string;
  noAnswers: string;
  platformsHeading: string;
  platformCols: {
    platform: string;
    asked: string;
    answered: string;
    mentioned: string;
    rate: string;
  };
  brandedHeading: string;
  brandedLine: (r: IntlCheckResult) => string;
  competitorsHeading: string;
  competitorsEmpty: string;
  countUnit: string;
  sourcesHeading: string;
  sourcesEmpty: string;
  websiteCited: string;
  websiteNotCited: string;
  findingsHeading: string;
  questionsHeading: string;
  questionsNote: string;
  ctaHeading: string;
  ctaBody: string;
  ctaReply: string;
  siteLinkLabel: string;
  siteUrl: string;
  gumroadLinkLabel: string;
  gumroadUrl: string;
  signatureIntro: string;
  signatureName: string;
  signatureRole: string;
  footer: string;
  mentionedMark: string;
  notMentionedMark: string;
  failedMark: string;
}

export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtRate(rate: number | null): string {
  return rate === null ? '–' : `${rate}%`;
}

function scoreColor(rate: number | null): string {
  if (rate === null) return '#6b7280';
  if (rate < 20) return '#dc2626';
  if (rate < 50) return '#d97706';
  return '#16a34a';
}

export function renderReport(r: IntlCheckResult, s: ReportStrings): string {
  const e = escapeHtml;
  const overall = r.overall.rate;

  const platformRows = r.platforms
    .map(
      (p) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f3;font-weight:600">${e(p.label)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f3;text-align:center">${p.asked}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f3;text-align:center">${p.answered}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f3;text-align:center">${p.mentioned}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f3;text-align:center;font-weight:700;color:${scoreColor(p.rate)}">${fmtRate(p.rate)}</td>
      </tr>`,
    )
    .join('');

  const competitorRows =
    r.competitors.length === 0
      ? `<p style="color:#6b7280;margin:8px 0">${e(s.competitorsEmpty)}</p>`
      : `<ol style="margin:8px 0 0 20px;padding:0">${r.competitors
          .map(
            (c) =>
              `<li style="margin:4px 0">${e(c.name)} <span style="color:#6b7280">— ${c.count}${e(s.countUnit)}</span></li>`,
          )
          .join('')}</ol>`;

  const sourceRows =
    r.sources.length === 0
      ? `<p style="color:#6b7280;margin:8px 0">${e(s.sourcesEmpty)}</p>`
      : `<ol style="margin:8px 0 0 20px;padding:0">${r.sources
          .map(
            (d) =>
              `<li style="margin:4px 0">${e(d.domain)} <span style="color:#6b7280">— ${d.count}${e(s.countUnit)}</span></li>`,
          )
          .join('')}</ol>`;

  const websiteLine = r.website
    ? `<p style="margin:10px 0 0;font-size:14px;color:${r.websiteCited ? '#16a34a' : '#dc2626'}">${e(
        r.websiteCited ? s.websiteCited : s.websiteNotCited,
      )}</p>`
    : '';

  const findings = r.findings
    .map((t) => `<li style="margin:8px 0;line-height:1.55">${e(t)}</li>`)
    .join('');

  const questionRows = r.questions
    .map((q) => {
      const cells = r.platforms
        .map((p) => {
          const o = q.observations.find((x) => x.platform === p.platform);
          const mark =
            !o || !o.ok
              ? s.failedMark
              : o.mentioned
                ? s.mentionedMark
                : s.notMentionedMark;
          const color =
            !o || !o.ok ? '#9ca3af' : o.mentioned ? '#16a34a' : '#dc2626';
          return `<td style="padding:6px 8px;border-bottom:1px solid #f1f3f5;text-align:center;color:${color};font-weight:700">${e(mark)}</td>`;
        })
        .join('');
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f3f5;font-size:13px;color:#374151">${q.branded ? '★ ' : ''}${e(q.text)}</td>${cells}
      </tr>`;
    })
    .join('');
  const questionHead = r.platforms
    .map(
      (p) =>
        `<th style="padding:6px 8px;text-align:center;font-size:12px;color:#6b7280">${e(p.label)}</th>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="${s.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(s.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:${s.fontFamily};color:#111827">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">${e(s.preheader(r))}</span>
<div style="max-width:640px;margin:0 auto;padding:32px 16px">
  <div style="background:#ffffff;border-radius:16px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">The Patient Funnel · AI Visibility Check</p>
    <h1 style="margin:0 0 4px;font-size:24px;line-height:1.3">${e(s.title)}</h1>
    <p style="margin:0 0 24px;color:#4b5563;font-size:15px">${e(s.subtitle(r))}</p>

    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:14px;padding:26px 24px;text-align:center;color:#fff;margin-bottom:28px">
      <div style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;opacity:.75">${e(s.scoreLabel)}</div>
      <div style="font-size:56px;font-weight:800;line-height:1.1;margin:6px 0;color:${overall === null ? '#e5e7eb' : overall < 20 ? '#f87171' : overall < 50 ? '#fbbf24' : '#4ade80'}">${fmtRate(overall)}</div>
      <div style="font-size:14px;opacity:.85">${e(r.overall.answered === 0 ? s.noAnswers : s.scoreCaption(r))}</div>
    </div>

    <h2 style="font-size:17px;margin:0 0 10px">${e(s.platformsHeading)}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:8px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280">${e(s.platformCols.platform)}</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280">${e(s.platformCols.asked)}</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280">${e(s.platformCols.answered)}</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280">${e(s.platformCols.mentioned)}</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280">${e(s.platformCols.rate)}</th>
        </tr>
      </thead>
      <tbody>${platformRows}</tbody>
    </table>
    <p style="margin:0 0 24px;font-size:13px;color:#6b7280"><strong>${e(s.brandedHeading)}</strong> ${e(s.brandedLine(r))}</p>

    <h2 style="font-size:17px;margin:0 0 6px">${e(s.competitorsHeading)}</h2>
    ${competitorRows}

    <h2 style="font-size:17px;margin:24px 0 6px">${e(s.sourcesHeading)}</h2>
    ${sourceRows}
    ${websiteLine}

    <h2 style="font-size:17px;margin:28px 0 6px">${e(s.findingsHeading)}</h2>
    <ul style="margin:0 0 0 20px;padding:0;font-size:15px">${findings}</ul>

    <div style="margin:32px 0 0;padding:22px 20px;border-radius:14px;background:#eef2ff;border:1px solid #c7d2fe">
      <h2 style="font-size:17px;margin:0 0 8px;color:#312e81">${e(s.ctaHeading)}</h2>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#1e1b4b">${e(s.ctaBody)}</p>
      <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#3730a3">${e(s.ctaReply)}</p>
      <p style="margin:0;font-size:14px;line-height:1.8">
        <a href="${e(s.siteUrl)}" style="color:#4338ca;font-weight:600">${e(s.siteLinkLabel)}</a><br>
        <a href="${e(s.gumroadUrl)}" style="color:#4338ca;font-weight:600">${e(s.gumroadLinkLabel)}</a>
      </p>
    </div>

    <h2 style="font-size:15px;margin:32px 0 6px;color:#374151">${e(s.questionsHeading)}</h2>
    <p style="margin:0 0 8px;font-size:12px;color:#6b7280">${e(s.questionsNote)}</p>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f9fafb"><th style="padding:6px 8px;text-align:left;font-size:12px;color:#6b7280"></th>${questionHead}</tr></thead>
        <tbody>${questionRows}</tbody>
      </table>
    </div>

    <p style="margin:32px 0 0;font-size:14px;line-height:1.6;color:#374151">${e(s.signatureIntro)}<br>
      <strong>${e(s.signatureName)}</strong><br>
      <span style="color:#6b7280">${e(s.signatureRole)}</span>
    </p>
  </div>
  <p style="margin:18px 8px 0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center">${e(s.footer)}</p>
</div>
</body>
</html>`;
}
