import { HubQuestionMaterials } from '../hospitals/hub-profile.service';

export type CoreQuestionSource = 'hub' | 'signal' | 'profile';

export interface CoreQuestion {
  query: string;
  category: string;
  intent: string;
  reason: string;
  source: CoreQuestionSource;
  alreadyTracked: boolean;
  promptId?: string;
}

interface CoreQuestionInput {
  name: string;
  specialty: string;
  region: string;
  localTreatments: string[];
  introduction: string | null;
  hubMaterials: HubQuestionMaterials;
  knownProcedures: Array<{
    name: string;
    alias: string[];
    isPopular?: boolean;
  }>;
  trackedPrompts: Array<{ id: string; promptText: string }>;
}

const normalize = (text: string) =>
  text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (value.length < 2 || value.length > 40) return false;
      const key = normalize(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function treatmentsInIntroduction(
  introduction: string,
  known: CoreQuestionInput['knownProcedures'],
): string[] {
  const text = normalize(introduction);
  if (!text) return [];
  return known
    .filter((procedure) =>
      [procedure.name, ...procedure.alias].some(
        (term) => term.length >= 2 && text.includes(normalize(term)),
      ),
    )
    .map((procedure) => procedure.name);
}

function concernFor(text: string): { label: string; question: string } | null {
  if (/비용|가격|견적|부담/.test(text)) {
    return { label: '비용', question: '비용과 치료 계획을 충분히 설명해 주는' };
  }
  if (/통증|아프|무섭|두렵|불안/.test(text)) {
    return {
      label: '치료 불안',
      question: '치료 과정과 통증 관리 방법을 설명해 주는',
    };
  }
  if (/기간|시간|오래|방문|내원/.test(text)) {
    return {
      label: '치료 기간',
      question: '치료 기간과 방문 횟수를 미리 설명해 주는',
    };
  }
  if (/부작용|회복|재치료|재수술/.test(text)) {
    return {
      label: '회복과 위험',
      question: '치료 후 회복과 주의할 점을 설명해 주는',
    };
  }
  if (/설명|상담|이해/.test(text)) {
    return {
      label: '상담과 설명',
      question: '진료 계획을 이해하기 쉽게 설명해 주는',
    };
  }
  return null;
}

/** 저장 없이 병원 정보에서 핵심 모니터링 질문을 만든다. */
export function buildCoreQuestions(input: CoreQuestionInput): CoreQuestion[] {
  const local = uniqueTerms(input.localTreatments);
  const introTreatments = treatmentsInIntroduction(
    input.introduction || '',
    input.knownProcedures,
  );
  const hub = uniqueTerms(input.hubMaterials.keyTreatments);
  const fallback = input.knownProcedures
    .filter((p) => p.isPopular)
    .slice(0, 3)
    .map((p) => p.name);
  const treatments = uniqueTerms([
    ...local,
    ...introTreatments,
    ...hub,
    ...fallback,
  ]);
  const primary = treatments[0];
  const secondary = treatments.find(
    (t) => normalize(t) !== normalize(primary || ''),
  );
  const treatmentSource = (treatment: string): CoreQuestionSource =>
    local.includes(treatment) || introTreatments.includes(treatment)
      ? 'signal'
      : hub.includes(treatment)
        ? 'hub'
        : 'profile';

  const candidates: Array<Omit<CoreQuestion, 'alreadyTracked' | 'promptId'>> =
    [];
  const add = (
    query: string,
    category: string,
    intent: string,
    reason: string,
    source: CoreQuestionSource,
  ) => {
    candidates.push({ query, category, intent, reason, source });
  };

  if (primary) {
    const source = treatmentSource(primary);
    const basis =
      source === 'hub'
        ? '허브에 등록된 주력 진료'
        : source === 'signal'
          ? '시그널 병원 정보의 주력 진료'
          : '진료과 기본 시술';
    add(
      `${input.region}에서 ${primary} 상담을 받아보려는데 어떤 ${input.specialty}를 비교해 보면 좋을까?`,
      '추천',
      'RESERVATION',
      `${basis}: ${primary}`,
      source,
    );

    const painPoint = input.hubMaterials.painPoints.find(
      (p) =>
        normalize(p.treatment).includes(normalize(primary)) ||
        normalize(primary).includes(normalize(p.treatment)),
    );
    const hubConcern = painPoint && concernFor(painPoint.points.join(' '));
    const localConcern = concernFor(input.introduction || '');
    const concern = hubConcern || localConcern;
    if (concern) {
      const concernSource: CoreQuestionSource = hubConcern ? 'hub' : 'signal';
      add(
        `${primary} 상담이 필요한데 ${input.region}에서 ${concern.question} ${input.specialty}는 어디야?`,
        concern.label === '비용' ? '가격' : '불안해소',
        concern.label === '비용' ? 'INFORMATION' : 'FEAR',
        `${hubConcern ? '허브의 환자 고민' : '시그널 병원 소개'}: ${concern.label}`,
        concernSource,
      );
    }
  }

  if (secondary) {
    add(
      `${input.region}에서 ${secondary} 진료를 받으려면 어떤 ${input.specialty}를 찾아보면 좋을까?`,
      '추천',
      'RESERVATION',
      `${treatmentSource(secondary) === 'hub' ? '허브에 등록된' : '병원 정보에 등록된'} 진료: ${secondary}`,
      treatmentSource(secondary),
    );
  }

  if (primary) {
    add(
      `${input.region} ${primary} ${input.specialty}를 고를 때 진료 계획과 비용을 어떻게 비교해야 할까?`,
      '비교',
      'COMPARISON',
      '주력 진료를 선택하기 전 환자가 비교하는 기준',
      treatmentSource(primary),
    );
  }
  add(
    `${input.region}에서 상담받을 만한 ${input.specialty}를 추천해줘`,
    '추천',
    'RESERVATION',
    '현재 병원 위치와 진료과를 반영한 기본 탐색 질문',
    'profile',
  );

  const tracked = new Map(
    input.trackedPrompts.map((p) => [normalize(p.promptText), p.id]),
  );
  const seen = new Set<string>();
  return candidates
    .filter(({ query }) => {
      const key = normalize(query);
      if (query.includes(input.name) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((candidate) => {
      const promptId = tracked.get(normalize(candidate.query));
      return {
        ...candidate,
        alreadyTracked: !!promptId,
        ...(promptId ? { promptId } : {}),
      };
    });
}
