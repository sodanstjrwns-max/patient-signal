import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HospitalsService } from './hospitals.service';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { normalizeOfficialChannelUrl, OfficialChannelField } from './official-channel-url';

describe('Official hospital channel URLs', () => {
  it.each([
    ['websiteUrl', ' bdbddc.com ', 'https://bdbddc.com/'],
    ['websiteUrl', 'https://clinic.example/pages?id=7&utm_source=ai#intro', 'https://clinic.example/pages?id=7'],
    ['blogUrl', 'm.blog.naver.com/clinic', 'https://blog.naver.com/clinic'],
    ['blogUrl', 'https://blog.naver.com/PostList.naver?blogId=clinic', 'https://blog.naver.com/clinic'],
    ['blogUrl', 'clinic.tistory.com', 'https://clinic.tistory.com/'],
    ['instagramUrl', 'instagram.com/clinic/?igsh=tracking', 'https://www.instagram.com/clinic/'],
    ['youtubeUrl', 'youtube.com/@clinic?si=tracking', 'https://www.youtube.com/@clinic'],
    ['youtubeUrl', 'https://m.youtube.com/channel/UC12345', 'https://www.youtube.com/channel/UC12345'],
  ])('normalizes %s %s without losing meaningful website query parameters', (field, input, expected) => {
    expect(normalizeOfficialChannelUrl(input, field as OfficialChannelField)).toBe(expected);
  });

  it.each([
    ['websiteUrl', 'javascript:alert(1)'],
    ['websiteUrl', 'https://user:password@clinic.example'],
    ['websiteUrl', 'https://clinic.example\\@other.example'],
    ['websiteUrl', 'https://clinic.example/a\npath'],
    ['instagramUrl', 'https://instagram.com.evil.example/clinic'],
    ['instagramUrl', 'https://instagram.com/'],
    ['instagramUrl', 'https://instagram.com/p/post'],
    ['youtubeUrl', 'https://youtube.com/'],
    ['youtubeUrl', 'https://youtube.com/watch?v=123'],
    ['youtubeUrl', 'https://youtu.be/123'],
    ['blogUrl', 'https://blog.naver.com/'],
    ['blogUrl', 'https://www.tistory.com/'],
  ])('rejects unsafe or unscoped %s %s', async (field, input) => {
    expect(() => normalizeOfficialChannelUrl(input, field as OfficialChannelField)).toThrow(BadRequestException);
    const dto = plainToInstance(UpdateHospitalDto, { [field]: input });
    expect((await validate(dto)).some((error) => error.property === field)).toBe(true);
  });

  it('allows explicit clears and leaves omitted fields untouched', async () => {
    expect(normalizeOfficialChannelUrl(undefined, 'websiteUrl')).toBeUndefined();
    expect(normalizeOfficialChannelUrl(null, 'websiteUrl')).toBeNull();
    expect(normalizeOfficialChannelUrl('  ', 'instagramUrl')).toBeNull();
    expect(await validate(plainToInstance(UpdateHospitalDto, { blogUrl: '', instagramUrl: null }))).toEqual([]);
  });
});

function setup() {
  const record: Record<string, unknown> = {
    id: 'hospital-1', name: '기존 병원', websiteUrl: 'https://old.example/',
    blogUrl: null, instagramUrl: null, youtubeUrl: null,
    keyProcedures: ['임플란트', '교정'], clinicIntroduction: '기존 소개',
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ hospitalId: record.id, role: 'OWNER' }),
      update: jest.fn().mockResolvedValue({}),
    },
    hospital: {
      update: jest.fn().mockImplementation(async ({ data }) => {
        Object.assign(record, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
        return { ...record };
      }),
      findUnique: jest.fn().mockImplementation(async () => ({ ...record })),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: record.id, ...data })),
    },
    subscription: { create: jest.fn().mockResolvedValue({}) },
    prompt: { createMany: jest.fn().mockResolvedValue({ count: 5 }) },
  };
  const cache = { invalidateHospital: jest.fn().mockResolvedValue(undefined) };
  const scheduler = { crawlSingleHospital: jest.fn().mockResolvedValue({}) };
  const hub = { isEnabled: jest.fn().mockReturnValue(false) };
  const service = new HospitalsService(prisma as any, scheduler as any, hub as any, cache as any);
  return { service, prisma, cache, record };
}

describe('Hospital official channel persistence', () => {
  it('saves all four channels, re-reads them, and invalidates old analysis cache', async () => {
    const { service, prisma, cache } = setup();
    await service.update('hospital-1', 'user-1', {
      websiteUrl: 'clinic.example', blogUrl: 'blog.naver.com/clinic',
      instagramUrl: 'instagram.com/clinic', youtubeUrl: 'youtube.com/@clinic',
    });
    const result = await service.findOne('hospital-1');
    expect(result).toMatchObject({
      websiteUrl: 'https://clinic.example/', blogUrl: 'https://blog.naver.com/clinic',
      instagramUrl: 'https://www.instagram.com/clinic/', youtubeUrl: 'https://www.youtube.com/@clinic',
      name: '기존 병원', clinicIntroduction: '기존 소개', keyProcedures: ['임플란트', '교정'],
    });
    expect(prisma.hospital.update).toHaveBeenCalledTimes(1);
    expect(cache.invalidateHospital).toHaveBeenCalledWith('hospital-1');
  });

  it('clears only the selected channel and invalidates cached default URL analysis', async () => {
    const { service, record, cache } = setup();
    record.blogUrl = 'https://blog.naver.com/clinic';
    await service.update('hospital-1', 'user-1', { websiteUrl: '' });
    expect(record.websiteUrl).toBeNull();
    expect(record.blogUrl).toBe('https://blog.naver.com/clinic');
    expect(cache.invalidateHospital).toHaveBeenCalledWith('hospital-1');
  });

  it('unrelated profile edits preserve channel URLs without invalidating channel cache', async () => {
    const { service, record, cache } = setup();
    await service.update('hospital-1', 'user-1', { clinicIntroduction: '새 소개' });
    expect(record.websiteUrl).toBe('https://old.example/');
    expect(cache.invalidateHospital).not.toHaveBeenCalled();
  });

  it('checks ownership and validates before any persistent update', async () => {
    const { service, prisma, cache } = setup();
    await expect(service.update('another-hospital', 'user-1', { websiteUrl: 'clinic.example' })).rejects.toThrow(ForbiddenException);
    await expect(service.update('hospital-1', 'user-1', { instagramUrl: 'https://evil.example/clinic' })).rejects.toThrow(BadRequestException);
    expect(prisma.hospital.update).not.toHaveBeenCalled();
    expect(cache.invalidateHospital).not.toHaveBeenCalled();
  });

  it('normalizes the same channel fields during hospital creation', async () => {
    const { service, prisma } = setup();
    await service.create('user-1', {
      name: '새 병원', specialtyType: 'DENTAL', regionSido: '서울특별시', regionSigungu: '강남구',
      websiteUrl: 'clinic.example', blogUrl: 'clinic.tistory.com',
      instagramUrl: 'instagram.com/clinic', youtubeUrl: 'youtube.com/channel/UC12345',
    });
    expect(prisma.hospital.create.mock.calls[0][0].data).toMatchObject({
      websiteUrl: 'https://clinic.example/', blogUrl: 'https://clinic.tistory.com/',
      instagramUrl: 'https://www.instagram.com/clinic/', youtubeUrl: 'https://www.youtube.com/channel/UC12345',
    });
  });
});
