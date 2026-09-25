import { HospitalsService } from './hospitals.service';

const hubProfile = {
  name: '허브 병원',
  basic: { clinic_type: '치과', region: '서울 강남구', key_treatments: ['임플란트'] },
  updated_at: '2026-09-25T09:00:00+09:00',
};

describe('HospitalsService Hub introduction', () => {
  it('허브 소개를 조회하되 Signal 병원 기록에는 자동 저장하지 않는다', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ hospital: { psHospitalId: 'ps-1' } }) },
      hospital: { update: jest.fn() },
    };
    const hub = {
      isEnabled: jest.fn().mockReturnValue(true),
      invalidate: jest.fn(),
      fetchProfile: jest.fn().mockResolvedValue(hubProfile),
    };
    const service = new HospitalsService(prisma as any, {} as any, hub as any, {} as any);

    const result = await service.getHubIntroduction('user-1', true);

    expect(hub.invalidate).toHaveBeenCalledWith('ps-1');
    expect(hub.fetchProfile).toHaveBeenCalledWith('ps-1');
    expect(result).toMatchObject({
      enabled: true,
      connected: true,
      introduction: expect.stringContaining('주력 진료: 임플란트'),
      sourceUpdatedAt: hubProfile.updated_at,
    });
    expect(prisma.hospital.update).not.toHaveBeenCalled();
  });

  it.each([null, new Error('Hub unavailable')])('허브 프로필이 없거나 실패하면 연결 상태를 표시하지 않는다', async (profileOrError) => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ hospital: { psHospitalId: 'ps-1' } }) },
    };
    const fetchProfile = jest.fn();
    if (profileOrError instanceof Error) fetchProfile.mockRejectedValue(profileOrError);
    else fetchProfile.mockResolvedValue(profileOrError);
    const hub = { isEnabled: jest.fn().mockReturnValue(true), fetchProfile };
    const service = new HospitalsService(prisma as any, {} as any, hub as any, {} as any);

    await expect(service.getHubIntroduction('user-1')).resolves.toEqual({
      enabled: true,
      connected: false,
      introduction: null,
      sourceUpdatedAt: null,
    });
  });

  it.each(['원장이 직접 고친 병원 소개', ''])('Signal에서 저장한 소개 %p를 허브 프리필이 덮어쓰지 않는다', async (savedIntroduction) => {
    const hospital = {
      id: 'hospital-1',
      psHospitalId: 'ps-1',
      name: 'Signal 병원',
      specialtyType: 'DENTAL',
      regionSido: '서울특별시',
      regionSigungu: '강남구',
      regionDong: '역삼동',
      coreTreatments: ['교정'],
      clinicIntroduction: savedIntroduction,
    };
    const prisma = { hospital: { findUnique: jest.fn().mockResolvedValue(hospital) } };
    const hub = { isEnabled: jest.fn().mockReturnValue(true), fetchProfile: jest.fn() };
    const service = new HospitalsService(prisma as any, {} as any, hub as any, {} as any);

    const result = await service.findOne(hospital.id);

    expect(result.clinicIntroduction).toBe(savedIntroduction);
    expect(hub.fetchProfile).not.toHaveBeenCalled();
  });

  it('소개만 수정할 때 다른 병원 필드를 지우지 않고 빈 소개도 그대로 저장한다', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ hospitalId: 'hospital-1', role: 'OWNER' }) },
      hospital: { update: jest.fn().mockResolvedValue({ clinicIntroduction: '' }) },
    };
    const service = new HospitalsService(prisma as any, {} as any, {} as any, {} as any);

    await service.update('hospital-1', 'user-1', { clinicIntroduction: '   ' });

    expect(prisma.hospital.update.mock.calls[0][0].data).toMatchObject({
      clinicIntroduction: '',
      businessNumber: undefined,
    });
  });
});
