import { buildHubIntroduction } from './hub-profile.service';

describe('buildHubIntroduction', () => {
  it('허브의 확인된 병원 사실만 소개로 옮기고 환자 인용문은 복사하지 않는다', () => {
    const introduction = buildHubIntroduction({
      name: '샘플 치과',
      basic: {
        clinic_type: '치과',
        region: '서울 강남구',
        key_treatments: ['임플란트', '교정'],
      },
      mvv: { status: 'confirmed', mission: '환자의 이해를 돕는다', slogan: '함께 결정합니다' },
      pain_points: [{ treatment: '임플란트', points: [{ quote: '실제 환자의 사적인 말' }] }],
    });

    expect(introduction).toContain('병원명: 샘플 치과');
    expect(introduction).toContain('주력 진료: 임플란트, 교정');
    expect(introduction).toContain('병원의 미션: 환자의 이해를 돕는다');
    expect(introduction).not.toContain('실제 환자의 사적인 말');
  });

  it('미확정 MVV나 병원명 하나만으로 소개를 만들지 않는다', () => {
    expect(buildHubIntroduction({ name: '샘플 치과' })).toBeNull();
    expect(buildHubIntroduction({
      name: '샘플 치과',
      mvv: { status: 'draft', mission: '검토 중인 문구' },
    })).toBeNull();
  });
});
