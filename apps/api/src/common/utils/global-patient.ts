/**
 * ═══════════════════════════════════════════════════════════
 *  Global Patient (외국인 환자 관점) 질문 생성 유틸
 *  - 의료관광/거주 외국인이 AI에 던지는 영어·중국어·일본어 질문 생성
 *  - 온보딩 자동 질문(⑩)과 Daily Prompt Matrix(global 축)에서 공용
 * ═══════════════════════════════════════════════════════════
 */

// ==================== 지역 영문 매핑 ====================

export const SIDO_EN: Record<string, string> = {
  '서울특별시': 'Seoul',
  '부산광역시': 'Busan',
  '대구광역시': 'Daegu',
  '인천광역시': 'Incheon',
  '광주광역시': 'Gwangju',
  '대전광역시': 'Daejeon',
  '울산광역시': 'Ulsan',
  '세종특별자치시': 'Sejong',
  '경기도': 'Gyeonggi',
  '강원특별자치도': 'Gangwon',
  '강원도': 'Gangwon',
  '충청북도': 'Chungbuk',
  '충청남도': 'Chungnam',
  '전라북도': 'Jeonbuk',
  '전북특별자치도': 'Jeonbuk',
  '전라남도': 'Jeonnam',
  '경상북도': 'Gyeongbuk',
  '경상남도': 'Gyeongnam',
  '제주특별자치도': 'Jeju',
  '제주도': 'Jeju',
};

export const SIGUNGU_EN: Record<string, string> = {
  // 서울 주요 구
  '강남구': 'Gangnam', '서초구': 'Seocho', '송파구': 'Songpa', '강동구': 'Gangdong',
  '마포구': 'Mapo', '용산구': 'Yongsan', '중구': 'Jung-gu', '종로구': 'Jongno',
  '영등포구': 'Yeongdeungpo', '성동구': 'Seongdong', '광진구': 'Gwangjin',
  '동작구': 'Dongjak', '관악구': 'Gwanak', '강서구': 'Gangseo', '양천구': 'Yangcheon',
  '구로구': 'Guro', '금천구': 'Geumcheon', '노원구': 'Nowon', '도봉구': 'Dobong',
  '강북구': 'Gangbuk', '성북구': 'Seongbuk', '중랑구': 'Jungnang', '동대문구': 'Dongdaemun',
  '서대문구': 'Seodaemun', '은평구': 'Eunpyeong',
  // 부산/대구/인천 등 주요 지역
  '해운대구': 'Haeundae', '수영구': 'Suyeong', '부산진구': 'Busanjin',
  '수성구': 'Suseong', '연수구': 'Yeonsu', '부평구': 'Bupyeong',
  // 경기 주요 시
  '성남시': 'Seongnam', '수원시': 'Suwon', '고양시': 'Goyang', '용인시': 'Yongin',
  '분당구': 'Bundang', '일산동구': 'Ilsan', '일산서구': 'Ilsan',
};

// 의료관광 주요 지역 중국어/일본어 (매핑 없으면 해당 언어 질문 생략)
export const REGION_ZH: Record<string, string> = {
  '서울특별시': '首尔', '부산광역시': '釜山', '대구광역시': '大邱', '인천광역시': '仁川', '제주특별자치도': '济州',
  '강남구': '江南区', '서초구': '瑞草区', '중구': '中区', '마포구': '麻浦区', '송파구': '松坡区', '해운대구': '海云台区',
};

export const REGION_JA: Record<string, string> = {
  '서울특별시': 'ソウル', '부산광역시': '釜山', '대구광역시': '大邱', '인천광역시': '仁川', '제주특별자치도': '済州',
  '강남구': '江南（カンナム）', '서초구': '瑞草（ソチョ）', '중구': '中区', '마포구': '麻浦（マポ）', '송파구': '松坡（ソンパ）', '해운대구': '海雲台',
};

/**
 * 영문 지역 표기 생성 (예: "Gangnam, Seoul")
 */
export function getEnglishRegion(regionSido: string, regionSigungu: string): string {
  const sido = SIDO_EN[regionSido] || '';
  const sigungu = SIGUNGU_EN[regionSigungu] || '';
  if (sido && sigungu) return `${sigungu}, ${sido}`;
  return sido || sigungu || 'Korea';
}

export function getEnglishCity(regionSido: string): string {
  return SIDO_EN[regionSido] || 'Korea';
}

// ==================== 진료과 다국어 매핑 ====================

export interface SpecialtyI18n {
  clinicEn: string;  // 시설명 (dental clinic)
  doctorEn: string;  // 의사명 (dentist)
  clinicZh: string;
  clinicJa: string;
}

export const SPECIALTY_I18N: Record<string, SpecialtyI18n> = {
  DENTAL: { clinicEn: 'dental clinic', doctorEn: 'dentist', clinicZh: '牙科诊所', clinicJa: '歯科医院' },
  DERMATOLOGY: { clinicEn: 'dermatology clinic', doctorEn: 'dermatologist', clinicZh: '皮肤科诊所', clinicJa: '皮膚科クリニック' },
  PLASTIC_SURGERY: { clinicEn: 'plastic surgery clinic', doctorEn: 'plastic surgeon', clinicZh: '整形外科医院', clinicJa: '美容整形クリニック' },
  ORTHOPEDICS: { clinicEn: 'orthopedic clinic', doctorEn: 'orthopedic doctor', clinicZh: '骨科医院', clinicJa: '整形外科クリニック' },
  KOREAN_MEDICINE: { clinicEn: 'Korean medicine clinic', doctorEn: 'Korean medicine doctor', clinicZh: '韩医院', clinicJa: '韓方クリニック' },
  OPHTHALMOLOGY: { clinicEn: 'eye clinic', doctorEn: 'eye doctor (ophthalmologist)', clinicZh: '眼科医院', clinicJa: '眼科クリニック' },
  INTERNAL_MEDICINE: { clinicEn: 'internal medicine clinic', doctorEn: 'physician', clinicZh: '内科诊所', clinicJa: '内科クリニック' },
  UROLOGY: { clinicEn: 'urology clinic', doctorEn: 'urologist', clinicZh: '泌尿科诊所', clinicJa: '泌尿器科クリニック' },
  ENT: { clinicEn: 'ENT clinic', doctorEn: 'ENT doctor', clinicZh: '耳鼻喉科诊所', clinicJa: '耳鼻咽喉科クリニック' },
  PSYCHIATRY: { clinicEn: 'mental health clinic', doctorEn: 'psychiatrist', clinicZh: '精神科诊所', clinicJa: '精神科クリニック' },
  OBSTETRICS: { clinicEn: 'OB-GYN clinic', doctorEn: 'OB-GYN doctor', clinicZh: '妇产科医院', clinicJa: '産婦人科クリニック' },
  PEDIATRICS: { clinicEn: 'pediatric clinic', doctorEn: 'pediatrician', clinicZh: '儿科诊所', clinicJa: '小児科クリニック' },
  OTHER: { clinicEn: 'clinic', doctorEn: 'doctor', clinicZh: '医院', clinicJa: 'クリニック' },
};

// ==================== 시술 다국어 매핑 ====================

interface ProcedureI18n { en: string; zh?: string; ja?: string }

export const PROCEDURE_I18N: Record<string, ProcedureI18n> = {
  // 치과
  '임플란트': { en: 'dental implants', zh: '种植牙', ja: 'インプラント' },
  '교정': { en: 'braces (orthodontics)', zh: '牙齿矫正', ja: '歯科矯正' },
  '치아교정': { en: 'braces (orthodontics)', zh: '牙齿矫正', ja: '歯科矯正' },
  '투명교정': { en: 'clear aligners (Invisalign)', zh: '隐形矫正', ja: 'マウスピース矯正' },
  '미백': { en: 'teeth whitening', zh: '牙齿美白', ja: 'ホワイトニング' },
  '치아미백': { en: 'teeth whitening', zh: '牙齿美白', ja: 'ホワイトニング' },
  '라미네이트': { en: 'veneers (laminates)', zh: '牙贴面', ja: 'ラミネート' },
  '충치치료': { en: 'cavity treatment', zh: '蛀牙治疗', ja: '虫歯治療' },
  '심미치료': { en: 'cosmetic dentistry', zh: '美容牙科', ja: '審美歯科' },
  '사랑니발치': { en: 'wisdom tooth extraction', zh: '拔智齿', ja: '親知らずの抜歯' },
  '신경치료': { en: 'root canal treatment', zh: '根管治疗', ja: '根管治療' },
  '잇몸치료': { en: 'gum treatment', zh: '牙龈治疗', ja: '歯周治療' },
  // 피부과
  '보톡스': { en: 'botox', zh: '肉毒素', ja: 'ボトックス' },
  '필러': { en: 'dermal fillers', zh: '玻尿酸填充', ja: 'ヒアルロン酸注入' },
  '리프팅': { en: 'skin lifting', zh: '提拉紧致', ja: 'リフトアップ' },
  '레이저토닝': { en: 'laser toning', zh: '激光美白', ja: 'レーザートーニング' },
  '탈모치료': { en: 'hair loss treatment', zh: '脱发治疗', ja: '薄毛治療' },
  // 안과
  '라식': { en: 'LASIK', zh: '激光矫视手术(LASIK)', ja: 'レーシック' },
  '라섹': { en: 'LASEK', zh: 'LASEK手术', ja: 'ラセック' },
  '스마일라식': { en: 'SMILE eye surgery', zh: 'SMILE全飞秒手术', ja: 'スマイルレーシック' },
  '백내장': { en: 'cataract surgery', zh: '白内障手术', ja: '白内障手術' },
  // 성형외과
  '코성형': { en: 'rhinoplasty (nose job)', zh: '隆鼻手术', ja: '鼻整形' },
  '눈성형': { en: 'double eyelid surgery', zh: '双眼皮手术', ja: '二重整形' },
  '지방흡입': { en: 'liposuction', zh: '吸脂手术', ja: '脂肪吸引' },
};

/**
 * 한국어 시술명 → 영어 (매핑 없으면 null)
 */
export function toEnglishProcedure(ko: string): string | null {
  if (PROCEDURE_I18N[ko]) return PROCEDURE_I18N[ko].en;
  // 부분 일치 (예: "임플란트(픽스처)" → 임플란트)
  for (const [key, val] of Object.entries(PROCEDURE_I18N)) {
    if (ko.includes(key)) return val.en;
  }
  return null;
}

function toI18nProcedure(ko: string): ProcedureI18n | null {
  if (PROCEDURE_I18N[ko]) return PROCEDURE_I18N[ko];
  for (const [key, val] of Object.entries(PROCEDURE_I18N)) {
    if (ko.includes(key)) return val;
  }
  return null;
}

// ==================== 외국인 환자 질문 생성 ====================

export interface GlobalPatientOptions {
  specialtyType: string;
  regionSido: string;
  regionSigungu: string;
  treatments?: string[];   // 한국어 시술명 리스트
  maxQuestions?: number;   // 기본 6 (영어 4 + 중국어 1 + 일본어 1)
}

/**
 * 외국인 환자(의료관광객, 거주 외국인)가 실제로 AI에 묻는 질문을 생성합니다.
 * 우선순위: 영어 → 중국어 → 일본어
 */
export function buildGlobalPatientQuestions(opts: GlobalPatientOptions): string[] {
  const spec = SPECIALTY_I18N[opts.specialtyType] || SPECIALTY_I18N.OTHER;
  const regionEn = getEnglishRegion(opts.regionSido, opts.regionSigungu);
  const cityEn = getEnglishCity(opts.regionSido);

  const article = /^[aeiou]/i.test(spec.clinicEn) ? 'an' : 'a';

  const procs = (opts.treatments || [])
    .map(t => toI18nProcedure(t))
    .filter((p): p is ProcedureI18n => p !== null);
  const p0 = procs[0];
  const p1 = procs[1];

  const q: string[] = [];

  // ── 영어 질문 (외국인 환자의 대표 검색 패턴) ──
  if (p0) {
    q.push(`Best ${spec.clinicEn} in ${regionEn} for ${p0.en}`);
    q.push(`How much does ${p0.en} cost in ${cityEn}? Recommend a trusted ${spec.clinicEn} for foreigners`);
  } else {
    q.push(`Best ${spec.clinicEn} in ${regionEn} for foreigners`);
  }
  q.push(`English speaking ${spec.doctorEn} in ${regionEn}`);
  q.push(`Recommend ${article} ${spec.clinicEn} in ${regionEn} that expats trust`);
  if (p1) {
    q.push(`Where is a good place to get ${p1.en} in ${regionEn} as a foreigner?`);
  }

  // ── 중국어 질문 (의료관광 최대 시장) ──
  const zhSigungu = REGION_ZH[opts.regionSigungu];
  const zhSido = REGION_ZH[opts.regionSido];
  if (zhSido || zhSigungu) {
    const regionZh = [zhSido, zhSigungu].filter(Boolean).join('');
    if (p0?.zh) {
      q.push(`${regionZh}哪家${spec.clinicZh}的${p0.zh}做得好？请推荐`);
    } else {
      q.push(`${regionZh}有哪些值得推荐的${spec.clinicZh}？`);
    }
  }

  // ── 일본어 질문 ──
  const jaSigungu = REGION_JA[opts.regionSigungu];
  const jaSido = REGION_JA[opts.regionSido];
  if (jaSido || jaSigungu) {
    const regionJa = jaSigungu ? `${jaSido || ''}${jaSido ? 'の' : ''}${jaSigungu}` : jaSido!;
    if (p0?.ja) {
      q.push(`${regionJa}で${p0.ja}が上手な${spec.clinicJa}を教えてください`);
    } else {
      q.push(`${regionJa}でおすすめの${spec.clinicJa}はどこですか？`);
    }
  }

  const max = opts.maxQuestions ?? 6;
  return [...new Set(q)].slice(0, max);
}
