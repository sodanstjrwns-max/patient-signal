'use client';

/**
 * 측정 공백 안내 배너 — 서비스 측 사유로 측정이 안 된 기간을 원장에게 명시한다.
 * 추이 그래프가 비어 있거나 낮게 보이는 것이 병원 노출 하락이 아님을 알리는 용도.
 * 기간은 OUTAGES에 고정 기록. 종료일 + 30일이 지나면 자동으로 사라진다. 닫기(localStorage) 지원.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const OUTAGES: { from: string; to: string; reason: string; hideAfter: string }[] = [
  {
    from: '2026-09-02',
    to: '2026-09-08',
    reason: '서버 이전 과정의 설정 누락으로 ChatGPT·Claude·Perplexity·Gemini 측정이 실행되지 않았습니다. 9월 8일 밤 복구했고, 9월 9일 오전 9시 측정부터 정상 반영됩니다.',
    hideAfter: '2026-10-08',
  },
];

const DISMISS_PREFIX = 'patient-signal-outage-dismissed-';

export function OutageNoticeBanner() {
  const [visible, setVisible] = useState<typeof OUTAGES>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const list = OUTAGES.filter((o) => today <= o.hideAfter).filter((o) => {
      try {
        return localStorage.getItem(DISMISS_PREFIX + o.from) !== '1';
      } catch {
        return true;
      }
    });
    setVisible(list);
  }, []);

  if (!visible.length) return null;

  return (
    <div className="mx-4 sm:mx-6 mt-3 space-y-2">
      {visible.map((o) => (
        <div
          key={o.from}
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">
              측정 공백 안내 · {o.from.replace(/-/g, '.')} ~ {o.to.replace(/-/g, '.')}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800">
              {o.reason} 이 기간의 추이가 비어 있거나 낮게 보이는 것은 실제 노출 하락이 아니라 측정 누락입니다. 죄송합니다.
            </p>
          </div>
          <button
            type="button"
            aria-label="안내 닫기"
            className="rounded-lg p-1 text-amber-700 hover:bg-amber-100"
            onClick={() => {
              try {
                localStorage.setItem(DISMISS_PREFIX + o.from, '1');
              } catch {}
              setVisible((v) => v.filter((x) => x.from !== o.from));
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
