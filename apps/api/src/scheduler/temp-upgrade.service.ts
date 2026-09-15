import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * 임시 플랜 업그레이드 (2026-09-14) — 스케줄러 모듈 소속.
 * AdminModule 이 SchedulerModule 을 import 하므로 여기 두어야 순환 의존이 없다.
 */
@Injectable()
export class TempUpgradeService {
  private readonly logger = new Logger(TempUpgradeService.name);
  constructor(private prisma: PrismaService) {}

  /**
   * 【2026-09-14】hospital.planType 만 기한부로 올린다 — 구독·빌링키는 손대지 않아 결제 영향 0.
   * 크롤 스케줄러·PlanGuard 는 hospital.planType 을 읽으므로 이것만으로 상위 플랜 기능이 열린다.
   * 마커: notifications 제목 `[임시 업그레이드 until YYYY-MM-DD revert <원래플랜>]` → 스케줄러가 매일 만료분 원복.
   */
  async tempUpgrade(opts: { hospitalId: string; plan: string; days: number; dryRun: boolean }) {
    const { hospitalId, plan, days, dryRun } = opts;
    const valid = ['STARTER', 'STANDARD', 'PRO', 'ENTERPRISE'];
    if (!valid.includes(plan)) return { error: `plan 은 ${valid.join('|')} 중 하나` };
    const h = await this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true, name: true, planType: true } });
    if (!h) return { error: 'HOSPITAL_NOT_FOUND' };
    const until = new Date(); until.setUTCDate(until.getUTCDate() + Math.max(1, Math.min(90, days)));
    const untilStr = until.toISOString().slice(0, 10);
    const existing = await this.prisma.notification.findFirst({ where: { hospitalId, title: { startsWith: '[임시 업그레이드 until' } }, orderBy: { sentAt: 'desc' } });
    if (existing && !dryRun) return { error: 'ALREADY_ACTIVE', existing: existing.title };
    const result = { hospital: h, from: h.planType, to: plan, until: untilStr, dry_run: dryRun };
    if (dryRun) return result;
    await this.prisma.$transaction([
      this.prisma.hospital.update({ where: { id: hospitalId }, data: { planType: plan as any } }),
      this.prisma.notification.create({ data: { hospitalId, notificationType: 'WEEKLY_REPORT', channel: 'EMAIL',
        title: `[임시 업그레이드 until ${untilStr} revert ${h.planType}] ${plan}`,
        message: `임시 업그레이드 ${h.planType} → ${plan}, ${untilStr} 까지. 결제·구독 변경 없음. 만료 시 자동 원복(진짜 결제로 상위 플랜이면 원복 생략).` } }),
    ]);
    this.logger.warn(`[임시 업그레이드] ${h.name} ${h.planType} → ${plan} until ${untilStr}`);
    return result;
  }

  /**
   * 【2026-09-15】임시 업그레이드 상태 조회 — 읽기 전용. 마커 존재 여부·만료일·원복 대상 플랜을 확인한다.
   * apply=1 재호출로 확인하면 마커 부재 시 동일 플랜 마커가 새로 생겨 원복 체계가 오염되므로, 검증은 반드시 이걸로.
   */
  async tempUpgradeStatus(hospitalId: string) {
    const h = await this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true, name: true, planType: true } });
    if (!h) return { error: 'HOSPITAL_NOT_FOUND' };
    const marks = await this.prisma.notification.findMany({
      where: { hospitalId, title: { startsWith: '[임시 업그레이드' } },
      orderBy: { sentAt: 'desc' },
      take: 10,
      select: { id: true, title: true, message: true, sentAt: true },
    });
    const active = marks.find((m) => m.title.startsWith('[임시 업그레이드 until'));
    let parsed: Record<string, string> | null = null;
    if (active) {
      const mt = active.title.match(/^\[임시 업그레이드 until (\d{4}-\d{2}-\d{2}) revert ([A-Z_]+)\] ([A-Z_]+)/);
      if (mt) parsed = { until: mt[1], revertTo: mt[2], upgradedTo: mt[3] };
    }
    return { hospital: h, active: active ? { title: active.title, sentAt: active.sentAt, parsed } : null, history: marks.map((m) => ({ title: m.title, sentAt: m.sentAt })) };
  }

  /** 만료된 임시 업그레이드 원복 (매일 스케줄러). 그 사이 결제로 상위 플랜 구독이 생겼으면 원복 생략. */
  async revertExpiredTempUpgrades() {
    const today = new Date().toISOString().slice(0, 10);
    const marks = await this.prisma.notification.findMany({ where: { title: { startsWith: '[임시 업그레이드 until' } } });
    const out: any[] = [];
    for (const m of marks) {
      const mt = m.title.match(/^\[임시 업그레이드 until (\d{4}-\d{2}-\d{2}) revert ([A-Z_]+)\] ([A-Z_]+)/);
      if (!mt) continue;
      const [, untilStr, original, upgraded] = mt;
      if (untilStr > today) continue;
      const h = await this.prisma.hospital.findUnique({ where: { id: m.hospitalId }, select: { id: true, name: true, planType: true } });
      const sub = await this.prisma.subscription.findUnique({ where: { hospitalId: m.hospitalId } }).catch(() => null);
      const paidHigher = sub && ['ACTIVE'].includes(sub.status) && sub.planType === upgraded;
      let action = 'skipped';
      if (h && h.planType === upgraded && !paidHigher) {
        await this.prisma.hospital.update({ where: { id: h.id }, data: { planType: original as any } });
        action = 'reverted';
      } else if (paidHigher) action = 'kept_paid';
      await this.prisma.notification.update({ where: { id: m.id }, data: { title: m.title.replace('[임시 업그레이드 until', '[임시 업그레이드 종료 until'), message: `${m.message} / ${today} ${action}` } });
      out.push({ hospital: h?.name, from: upgraded, to: original, action });
    }
    return { today, processed: out.length, results: out };
  }
}
