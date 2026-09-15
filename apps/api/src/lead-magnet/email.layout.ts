/**
 * Free-preview nurture sequence — shared HTML e-mail layout.
 *
 * Plain, text-first design on purpose: these read as letters from the author,
 * not as campaign templates. Every message carries the sender block and a
 * working unsubscribe link (JP 特定電子メール法 / US CAN-SPAM).
 */

export interface LeadEmail {
  subject: string;
  /** paragraphs; a string that is exactly a URL is rendered as a button */
  body: string[];
}

export interface LayoutStrings {
  htmlLang: string;
  fontFamily: string;
  signature: string;
  senderBlock: string;
  why: string;
  unsubscribe: string;
}

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Turn bare URLs inside a paragraph into links. */
const linkify = (s: string): string =>
  esc(s).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#0b6b5e">$1</a>',
  );

export function renderLeadEmail(
  email: LeadEmail,
  strings: LayoutStrings,
  unsubscribeUrl: string,
): string {
  const paras = email.body
    .map((p) => {
      if (/^https?:\/\/\S+$/.test(p.trim())) {
        const url = p.trim();
        return `<p style="margin:26px 0"><a href="${esc(url)}" style="display:inline-block;background:#0b6b5e;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:600">${esc(
          strings.htmlLang === 'ja'
            ? '無料プレビューをダウンロード'
            : 'Download the free preview',
        )}</a></p>`;
      }
      return `<p style="margin:0 0 18px;line-height:1.75">${linkify(p)}</p>`;
    })
    .join('\n');

  return `<!doctype html><html lang="${strings.htmlLang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f2">
<div style="max-width:560px;margin:0 auto;padding:32px 22px;font-family:${strings.fontFamily};font-size:16px;color:#1a1a1a">
${paras}
<p style="margin:26px 0 0;line-height:1.75">${esc(strings.signature)}</p>
<hr style="border:0;border-top:1px solid #e2e0da;margin:30px 0 16px">
<p style="margin:0 0 10px;font-size:12px;line-height:1.7;color:#6b6b6b">${esc(strings.senderBlock)}</p>
<p style="margin:0 0 10px;font-size:12px;line-height:1.7;color:#6b6b6b">${esc(strings.why)}</p>
<p style="margin:0;font-size:12px;line-height:1.7;color:#6b6b6b"><a href="${esc(unsubscribeUrl)}" style="color:#6b6b6b">${esc(strings.unsubscribe)}</a></p>
</div></body></html>`;
}
