'use client';

import { useState } from 'react';
import {
  Sparkles,
  Search,
  BarChart3,
  Building2,
  Rocket,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingTutorialProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const slides = [
  {
    icon: Sparkles,
    iconBg: 'bg-[#08090a]',
    title: 'Patient Signal에 오신 것을 환영합니다!',
    subtitle: 'AI 시대, 병원 마케팅의 새로운 기준',
    description: 'ChatGPT, Perplexity 등 AI 검색에서 우리 병원이 얼마나 추천되는지 실시간으로 추적하세요.',
    highlight: '이제 환자들은 "강남 병원 추천해줘"라고 AI에게 물어봅니다.',
  },
  {
    icon: Search,
    iconBg: 'bg-[#08090a]',
    title: 'AI 검색 가시성이란?',
    subtitle: '새로운 시대의 SEO',
    description: '기존 SEO가 구글 검색 순위였다면, AI 가시성은 AI가 우리 병원을 얼마나 자주, 긍정적으로 추천하는지를 의미합니다.',
    highlight: 'AI가 추천하는 병원 = 환자가 선택하는 병원',
  },
  {
    icon: BarChart3,
    iconBg: 'bg-[#08090a]',
    title: '어떻게 측정하나요?',
    subtitle: '자동화된 AI 모니터링',
    description: 'Patient Signal이 AI에게 다양한 질문을 자동으로 던지고, 응답에서 우리 병원이 언급되는지 분석합니다.',
    bullets: [
      '"강남역 근처 임플란트 잘하는 병원"',
      '"서울 교정 병원 추천"',
      '"00동 병원 어디가 좋아요"',
    ],
  },
  {
    icon: Building2,
    iconBg: 'bg-[#08090a]',
    title: '시작하기',
    subtitle: '3단계로 간단하게',
    steps: [
      { num: '1', title: '병원 정보 입력', desc: '병원명, 지역, 진료과목 등록' },
      { num: '2', title: '프롬프트 설정', desc: 'AI에게 물어볼 질문 설정 (자동 생성 지원)' },
      { num: '3', title: '크롤링 시작', desc: '버튼 한 번으로 AI 응답 수집 시작' },
    ],
  },
  {
    icon: Rocket,
    iconBg: 'bg-[#08090a]',
    title: '준비 완료!',
    subtitle: '이제 시작해볼까요?',
    description: '대시보드에서 실시간으로 AI 가시성 점수를 확인하고, 경쟁 병원과 비교해보세요.',
    features: [
      '📊 실시간 점수 트래킹',
      '🏥 경쟁사 비교 분석',
      '📈 주간/월간 트렌드',
      '💡 개선 인사이트 제공',
    ],
  },
];

export default function OnboardingTutorial({ onComplete, onSkip }: OnboardingTutorialProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = slides[currentSlide];
  const Icon = slide.icon;
  const isLastSlide = currentSlide === slides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08090a]/55 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="signal-tutorial-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-[#30343a] bg-[#08090a] shadow-none">
        <div className="flex items-center justify-between border-b border-[#30343a] px-6 py-4 sm:px-8">
          <p className="text-[10px] font-medium tracking-[0.16em] text-[#959c9f]">YOUR FIRST SIGNAL / {String(currentSlide + 1).padStart(2, '0')}</p>
          {onSkip && <button onClick={onSkip} aria-label="가이드 닫기" className="p-1 text-[#959c9f] hover:text-[#f5f5ef]"><X className="h-5 w-5" /></button>}
        </div>
        <div className="px-6 py-8 sm:px-8">
          <div className="mb-7 flex items-center justify-between"><span className="flex h-14 w-14 items-center justify-center bg-[#ff6a24]"><Icon className="h-7 w-7 text-[#08090a]" /></span><span className="text-5xl font-light tracking-[-0.08em] text-[#c0c4c7]">0{currentSlide + 1}</span></div>
          <p className="mb-2 text-[11px] font-medium text-[#c0c4c7]">{slide.subtitle}</p>
          <h2 id="signal-tutorial-title" className="font-display mb-5 text-[28px] font-semibold leading-tight tracking-[-0.055em] text-[#f5f5ef]">{slide.title}</h2>
          {slide.description && <p className="mb-6 text-sm leading-7 text-[#c0c4c7]">{slide.description}</p>}
          {slide.highlight && <div className="mb-6 border-l-2 border-[#d9ff43] pl-4"><p className="text-xs font-medium leading-6 text-[#c0c4c7]">{slide.highlight}</p></div>}
          {slide.bullets && <div className="mb-6 divide-y divide-[#30343a] border-y border-[#30343a]">{slide.bullets.map((bullet, i) => <p key={i} className="flex gap-3 py-3 text-xs leading-6 text-[#c0c4c7]"><span className="font-mono text-[#959c9f]">0{i + 1}</span>{bullet}</p>)}</div>}
          {slide.steps && <div className="mb-6">{slide.steps.map(step => <div key={step.num} className="flex items-start gap-4 border-b border-[#30343a] py-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#111315] text-xs text-[#c0c4c7]">{step.num}</span><div><p className="text-sm font-semibold text-[#f5f5ef]">{step.title}</p><p className="mt-1 text-xs leading-6 text-[#959c9f]">{step.desc}</p></div></div>)}</div>}
          {slide.features && <div className="mb-6 grid grid-cols-1 gap-0 border-t border-[#30343a] sm:grid-cols-2">{slide.features.map((feature,i) => <div key={i} className="border-b border-[#30343a] py-4 text-xs text-[#c0c4c7]">{feature}</div>)}</div>}
          <div className="mb-7 flex gap-1.5" aria-label="가이드 단계">{slides.map((_,i) => <button key={i} onClick={() => setCurrentSlide(i)} aria-label={`${i + 1}단계로 이동`} aria-current={i === currentSlide ? 'step' : undefined} className={`h-1 flex-1 transition-colors ${i === currentSlide ? 'bg-[#d9ff43]' : 'bg-[#30343a] hover:bg-[#989b8d]'}`} />)}</div>
          <div className="flex gap-3">{currentSlide > 0 && <Button variant="outline" onClick={handlePrev} className="flex-1"><ChevronLeft className="mr-1 h-4 w-4" />이전</Button>}<Button onClick={handleNext} className="flex-1 bg-[#ff6a24] text-[#08090a] hover:bg-[#ff8750]">{isLastSlide ? '시작하기' : '다음'}{!isLastSlide && <ChevronRight className="ml-1 h-4 w-4" />}</Button></div>
        </div>
      </section>
    </div>
  );
}
