/**
 * International AI Visibility Check — Japanese question templates.
 *
 * Same 20 intents as templates.en.ts (RESERVATION / COMPARISON / INFORMATION /
 * REVIEW / FEAR), 3 branded templates containing {clinicName}.
 * Placeholders: {city} {country} {clinicName} {practitioner} {place} {places}
 *               {proc1} {proc2} {proc3} {emergency} {sedation} {kids} {tech}
 */
import type {
  IntlQuestionTemplate,
  IntlSpecialtyVocab,
} from './templates.types';

export const JA_SPECIALTY_VOCAB: Record<string, IntlSpecialtyVocab> = {
  dental: {
    practitioner: '歯科医',
    place: '歯科医院',
    places: '歯科医院',
    proc1: 'インプラント',
    proc2: 'マウスピース矯正やワイヤー矯正',
    proc3: '根管治療',
    emergency: '急患対応の歯科医院',
    sedation: '静脈内鎮静法（無痛治療）',
    kids: '小児歯科',
    tech: '3Dスキャンや即日セラミック（CAD/CAM）',
  },
  dermatology: {
    practitioner: '皮膚科医',
    place: '皮膚科クリニック',
    places: '皮膚科クリニック',
    proc1: 'ニキビ跡治療',
    proc2: 'ボトックスやヒアルロン酸注入',
    proc3: 'レーザー治療',
    emergency: '当日診察できる皮膚科',
    sedation: '痛みの少ない治療',
    kids: '小児皮膚科',
    tech: '最新のレーザー機器',
  },
  orthopedics: {
    practitioner: '整形外科医',
    place: '整形外科クリニック',
    places: '整形外科クリニック',
    proc1: '人工膝関節置換術',
    proc2: '腰痛・脊椎の治療',
    proc3: '肩の手術',
    emergency: '急患対応の整形外科',
    sedation: '低侵襲治療',
    kids: '小児整形外科',
    tech: 'ロボット支援手術',
  },
  ophthalmology: {
    practitioner: '眼科医',
    place: '眼科クリニック',
    places: '眼科クリニック',
    proc1: 'レーシック',
    proc2: '白内障手術',
    proc3: '眼の手術',
    emergency: '救急対応の眼科',
    sedation: '不安の少ない快適な手術',
    kids: '小児眼科',
    tech: '最新のレーザー機器',
  },
  plastic_surgery: {
    practitioner: '美容外科医',
    place: '美容外科クリニック',
    places: '美容外科クリニック',
    proc1: '鼻の整形',
    proc2: 'フェイスリフトや二重整形',
    proc3: '脂肪吸引',
    emergency: '修正手術の相談',
    sedation: '安全な麻酔とモニタリング',
    kids: '10代向けの美容外科',
    tech: '3Dシミュレーション',
  },
  general: {
    practitioner: '医師',
    place: 'クリニック',
    places: 'クリニック',
    proc1: '人間ドック',
    proc2: '生活習慣病の管理',
    proc3: '小さな処置',
    emergency: '当日診察できるクリニック',
    sedation: '落ち着いて受診できる環境',
    kids: '子どもも診てくれる家庭医',
    tech: 'オンライン予約や最新設備',
  },
};

export const JA_COUNTRY_NAMES: Record<string, string> = {
  JP: '日本',
  US: 'アメリカ',
  UK: 'イギリス',
  GB: 'イギリス',
  AU: 'オーストラリア',
  CA: 'カナダ',
  NZ: 'ニュージーランド',
  SG: 'シンガポール',
  KR: '韓国',
};

export const JA_TEMPLATES: IntlQuestionTemplate[] = [
  // ── RESERVATION（おすすめ・近く・予約）──
  {
    key: 'recommend_near',
    intent: 'RESERVATION',
    text: '{city}でおすすめの{practitioner}を教えてください。',
  },
  {
    key: 'best_for_proc1',
    intent: 'RESERVATION',
    text: '{city}で{proc1}が得意な{place}はどこですか？',
  },
  {
    key: 'best_for_proc2',
    intent: 'RESERVATION',
    text: '{city}で{proc2}の評判が良い{place}を教えてください。',
  },
  {
    key: 'emergency',
    intent: 'RESERVATION',
    text: '今日{city}で{emergency}を探しています。どこに行けばいいですか？',
  },
  {
    key: 'kids',
    intent: 'RESERVATION',
    text: '{city}で怖がりの6歳の子どもにおすすめの{kids}はありますか？',
  },
  {
    key: 'new_patients',
    intent: 'RESERVATION',
    text: '{city}で新患を受け付けていて、1週間以内に予約できる{places}はどこですか？',
  },
  {
    key: 'weekend',
    intent: 'RESERVATION',
    text: '{city}で土曜日や夜間に診療している{places}を教えてください。',
  },

  // ── COMPARISON（比較・トップ3）──
  {
    key: 'best_overall',
    intent: 'COMPARISON',
    text: '{country}の{city}で一番評判の良い{places}はどこですか？',
  },
  {
    key: 'top3_compare',
    intent: 'COMPARISON',
    text: '{city}の{places}トップ3を、それぞれの長所と短所を含めて比較してください。',
  },
  {
    key: 'modern_tech',
    intent: 'COMPARISON',
    text: '{city}で{tech}など最新設備がそろっている{place}はどこですか？',
  },

  // ── INFORMATION（費用・相談・選び方）──
  {
    key: 'price',
    intent: 'INFORMATION',
    text: '{city}で{proc1}の費用はいくらくらいですか？良心的な価格の医院も教えてください。',
  },
  {
    key: 'consultation',
    intent: 'INFORMATION',
    text: '{city}で{proc2}の無料相談や初診相談ができる{place}はありますか？',
  },
  {
    key: 'how_to_choose',
    intent: 'INFORMATION',
    text: '{city}で{practitioner}を選ぶポイントは？具体的な医院名も挙げてください。',
  },

  // ── REVIEW（信頼・口コミ）──
  {
    key: 'trustworthy',
    intent: 'REVIEW',
    text: '{city}で患者の口コミから見て信頼できる{practitioner}はどこですか？',
  },
  {
    key: 'google_ratings',
    intent: 'REVIEW',
    text: '{city}でGoogleの評価が高い{places}を教えてください。',
  },

  // ── FEAR（不安・痛み・無痛）──
  {
    key: 'sedation',
    intent: 'FEAR',
    text: '{city}で{sedation}に対応している、治療が怖い人向けの{place}はありますか？',
  },
  {
    key: 'gentle',
    intent: 'FEAR',
    text: '{proc3}が怖いです。{city}で優しくて経験豊富な{practitioner}を教えてください。',
  },

  // ── Branded（医院名入り）──
  {
    key: 'branded_good',
    intent: 'REVIEW',
    branded: true,
    text: '{city}の{clinicName}は良い{place}ですか？患者の評判はどうですか？',
  },
  {
    key: 'branded_should_i_go',
    intent: 'COMPARISON',
    branded: true,
    text: '{proc1}なら{clinicName}に行くべきですか？それとも{city}にもっと良い選択肢がありますか？',
  },
  {
    key: 'branded_reviews',
    intent: 'REVIEW',
    branded: true,
    text: '{city}の{clinicName}の口コミや評判を教えてください。',
  },
];
