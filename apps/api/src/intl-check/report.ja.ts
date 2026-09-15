/**
 * International AI Visibility Check — Japanese e-mail report.
 */
import type { IntlCheckResult } from './analysis';
import { renderReport, type ReportStrings } from './report.layout';

export const JA_SITE_URL = 'https://thepatientfunnel.com/jp/';
export const JA_GUMROAD_URL =
  'https://sodanstjrwns.gumroad.com/l/patientfunnel-ja';

export function subjectJa(clinicName: string): string {
  return `AI可視性チェック結果：${clinicName}`;
}

const rateText = (r: IntlCheckResult) =>
  r.overall.rate === null ? '—' : `${r.overall.rate}%`;

export const JA_STRINGS: ReportStrings = {
  lang: 'ja',
  htmlLang: 'ja',
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',Meiryo,sans-serif",
  preheader: (r) =>
    `${r.city}に関するAIの回答のうち${rateText(r)}で${r.clinicName}が挙げられました。`,
  title: 'AI可視性チェック結果',
  subtitle: (r) =>
    `${r.clinicName} · ${r.city}${r.country ? `（${r.country}）` : ''} · 患者の質問${r.questions.length}件 × AIプラットフォーム${r.platformsUsed.length}種`,
  scoreLabel: 'AI登場率',
  scoreCaption: (r) =>
    `${r.overall.answered}件の回答のうち${r.overall.mentioned}件で${r.clinicName}が挙げられました`,
  noAnswers: '今回はAIプラットフォームから回答を取得できませんでした。',
  platformsHeading: 'プラットフォーム別',
  platformCols: {
    platform: 'プラットフォーム',
    asked: '質問数',
    answered: '回答数',
    mentioned: '言及数',
    rate: '登場率',
  },
  brandedHeading: '医院名入りの質問（★）：',
  brandedLine: (r) =>
    r.branded.answered === 0
      ? '回答なし。'
      : `${r.branded.answered}件中${r.branded.mentioned}件で言及（${r.branded.rate}%）。医院名なしの質問：${r.unbranded.answered}件中${r.unbranded.mentioned}件（${r.unbranded.rate ?? '—'}%）。`,
  competitorsHeading: 'AIが代わりに挙げた医院（上位10）',
  competitorsEmpty: 'AIの回答に具体的な医院名はありませんでした。',
  countUnit: '回',
  sourcesHeading: 'AIが根拠にした情報源（上位10ドメイン）',
  sourcesEmpty: '今回の回答では出典が示されませんでした。',
  websiteCited: '貴院の公式サイトは少なくとも1回引用されました。',
  websiteNotCited: '貴院の公式サイトはAIに一度も引用されませんでした。',
  findingsHeading: '結果の読み方',
  questionsHeading: '20の質問すべて',
  questionsNote:
    '✓ 言及あり · ✗ 言及なし · – 回答なし。★ = 質問に貴院名を含む。',
  ctaHeading: '毎週自動で追跡する',
  ctaBody:
    '今回の結果は一度きりのスナップショットです。口コミ・掲載情報・競合の変化により、AIの回答は毎週変わります。週次の自動追跡サービス（月額$99）を準備中です：同じ20の質問を全プラットフォームで毎週測定し、言及の増減をお知らせします。',
  ctaReply:
    'このメールに「YES」と返信いただくと、先行案内リストに登録されます。',
  siteLinkLabel: 'thepatientfunnel.com/jp — AIに推薦される医院のつくり方',
  siteUrl: JA_SITE_URL,
  gumroadLinkLabel: 'The Patient Funnel（日本語版）',
  gumroadUrl: JA_GUMROAD_URL,
  auditHeading: '本の前に、自院を採点する',
  auditBody:
    'このレポートが見たのは第一段階「認知」だけです。無料の診断票は10段階すべてを扱います。「はい・いいえ」で答える30行、30点満点。終えたときには、どの段階が漏れているかが分かります。10段階のうち二つは本文まるごと付いています。無料です。',
  auditButton: '無料の診断票を受け取る',
  auditUrl: 'https://thepatientfunnel.com/jp/preview/',
  signatureIntro: 'ご質問はこのメールにそのまま返信してください。',
  signatureName: 'Suokjoon Moon',
  signatureRole: 'The Patient Funnel · Patient Signal',
  footer:
    'このメールは thepatientfunnel.com でAI可視性チェックをお申し込みいただいた方にお送りしています。一度きりの送信で、返信がない限り他のメールはお送りしません。',
  mentionedMark: '✓',
  notMentionedMark: '✗',
  failedMark: '–',
};

export function renderReportJa(result: IntlCheckResult): string {
  return renderReport(result, JA_STRINGS);
}
