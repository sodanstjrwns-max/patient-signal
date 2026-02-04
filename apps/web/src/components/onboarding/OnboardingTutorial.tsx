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
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    title: 'Patient Signal에 오신 것을 환영합니다!',
    subtitle: 'AI 시대, 병원 마케팅의 새로운 기준',
    description: 'ChatGPT, Perplexity 등 AI 검색에서 우리 병원이 얼마나 추천되는지 실시간으로 추적하세요.',
    highlight: '이제 환자들은 "강남 치과 추천해줘"라고 AI에게 물어봅니다.',
  },
  {
    icon: Search,
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
    title: 'AI 검색 가시성이란?',
    subtitle: '새로운 시대의 SEO',
    description: '기존 SEO가 구글/네이버 검색 순위였다면, AI 가시성은 AI가 우리 병원을 얼마나 자주, 긍정적으로 추천하는지를 의미합니다.',
    highlight: 'AI가 추천하는 병원 = 환자가 선택하는 병원',
  },
  {
    icon: BarChart3,
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
    title: '어떻게 측정하나요?',
    subtitle: '자동화된 AI 모니터링',
    description: 'Patient Signal이 AI에게 다양한 질문을 자동으로 던지고, 응답에서 우리 병원이 언급되는지 분석합니다.',
    bullets: [
      '"강남역 근처 임플란트 잘하는 치과"',
      '"서울 교정 치과 추천"',
      '"00동 치과 어디가 좋아요"',
    ],
  },
  {
    icon: Building2,
    iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600',
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
    iconBg: 'bg-gradient-to-br from-pink-500 to-pink-600',
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header with skip button */}
        <div className="flex justify-end p-4 pb-0">
          {onSkip && (
            <button
              onClick={onSkip}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-8 pb-8 pt-2">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-20 h-20 rounded-2xl ${slide.iconBg} flex items-center justify-center shadow-lg`}>
              <Icon className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {slide.title}
          </h2>
          <p className="text-blue-600 font-medium text-center mb-4">
            {slide.subtitle}
          </p>

          {/* Description */}
          {slide.description && (
            <p className="text-gray-600 text-center mb-4 leading-relaxed">
              {slide.description}
            </p>
          )}

          {/* Highlight */}
          {slide.highlight && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
              <p className="text-blue-800 text-sm text-center font-medium">
                💡 {slide.highlight}
              </p>
            </div>
          )}

          {/* Bullets */}
          {slide.bullets && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
              {slide.bullets.map((bullet, i) => (
                <p key={i} className="text-gray-700 text-sm flex items-center gap-2">
                  <span className="text-blue-500">•</span>
                  {bullet}
                </p>
              ))}
            </div>
          )}

          {/* Steps */}
          {slide.steps && (
            <div className="space-y-3 mb-4">
              {slide.steps.map((step) => (
                <div key={step.num} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center flex-shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{step.title}</p>
                    <p className="text-sm text-gray-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Features */}
          {slide.features && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {slide.features.map((feature, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                  {feature}
                </div>
              ))}
            </div>
          )}

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentSlide 
                    ? 'bg-blue-600 w-6' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {currentSlide > 0 && (
              <Button
                variant="outline"
                onClick={handlePrev}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                이전
              </Button>
            )}
            <Button
              onClick={handleNext}
              className={`flex-1 ${currentSlide === 0 ? 'w-full' : ''}`}
            >
              {isLastSlide ? '시작하기' : '다음'}
              {!isLastSlide && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
