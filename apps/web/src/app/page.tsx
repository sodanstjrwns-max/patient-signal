"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CornerDownRight, Link2 } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import {
  PublicHeader,
  SignalMark,
  SignalWordmark,
} from "@/components/public/PublicBrand";
import { Reveal } from "@/components/motion/SignalMotion";
import { useAuthStore } from "@/stores/auth";

const HUB_SSO_START_URL =
  (process.env.NEXT_PUBLIC_API_URL || "https://api.patientsignal.kr/api") +
  "/auth/hub";
const platforms = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Perplexity",
  "Grok",
  "CLOVA X",
  "네이버 AI 브리핑",
];
const demoPlatforms = ["ChatGPT", "Claude", "Perplexity"];
const examples = [
  {
    label: "임플란트 상담",
    tag: "진료에 관한 질문",
    question: "우리 동네에서 임플란트 상담을 받을 치과를 찾고 있어요.",
    answers: [
      "병원을 비교할 때는 어떤 진료를 제공하는지, 상담 과정은 어떻게 진행되는지 살펴볼 수 있습니다. 병원 소개에 담긴 진료 정보가 답변에 어떻게 반영되는지 확인해 보세요.",
      "지역과 진료 내용을 함께 살펴보면 비교할 병원의 범위를 좁힐 수 있습니다. 이 화면에서는 AI가 병원을 소개할 때 어떤 특징을 언급했는지 읽어볼 수 있습니다.",
      "지역의 병원 정보를 바탕으로 진료 내용과 상담 안내를 비교하는 답변 예시입니다. 실제 서비스에서는 수집된 답변 원문과 병원 언급 여부를 확인합니다.",
    ],
  },
  {
    label: "아이와 방문",
    tag: "환자 상황에 관한 질문",
    question: "아이와 함께 방문할 치과를 찾을 때 어떤 정보를 봐야 할까요?",
    answers: [
      "아이와 방문할 병원을 알아볼 때는 해당 진료의 제공 여부와 예약 안내를 확인할 수 있습니다. 이처럼 환자분의 상황에 따라 AI가 답변에서 강조하는 정보가 달라집니다.",
      "병원이 안내하는 진료 대상, 상담 방식, 방문 정보를 함께 살펴보는 답변 예시입니다. 우리 병원의 설명이 어떤 질문과 연결되는지 확인해 보세요.",
      "병원 소개와 방문 안내를 참고해 필요한 정보를 정리하는 답변 예시입니다. Patient Signal에서는 질문별로 수집한 원문을 열어 실제 설명을 읽을 수 있습니다.",
    ],
  },
  {
    label: "퇴근 후 진료",
    tag: "방문 조건에 관한 질문",
    question: "퇴근 후에 방문할 수 있는 가까운 치과를 어떻게 찾을까요?",
    answers: [
      "방문 가능한 시간과 지역을 함께 확인해 보세요. AI의 설명에 진료 시간이나 위치가 포함됐는지, 병원에서 안내하는 정보와 일치하는지 살펴볼 수 있습니다.",
      "진료 시간과 위치처럼 방문 결정에 필요한 정보를 정리하는 답변 예시입니다. 병원 소개에서 중요한 정보가 AI 답변에도 전달되는지 확인해 보세요.",
      "지역과 진료 시간 조건에 맞는 정보를 비교하는 답변 예시입니다. 실제 방문 전에는 해당 병원의 최신 예약·진료 안내를 확인할 수 있습니다.",
    ],
  },
];
const steps = [
  {
    title: "병원의 이야기를 연결.",
    label: "CONNECT",
    description:
      "Patient Hub의 병원 소개를 가져오세요. 지역과 주력 진료, 병원의 특징을 확인하고 직접 수정할 수 있습니다.",
    detail: "Hub에서 연결한 소개도 우리 병원에 맞게 계속 다듬을 수 있습니다.",
    chips: ["병원 소개", "진료와 지역", "직접 편집"],
    href: "/dashboard/settings",
    link: "병원 소개 관리",
  },
  {
    title: "중요한 질문을 선택.",
    label: "ASK",
    description:
      "병원 정보를 바탕으로 추천한 핵심 질문을 검토하세요. 환자분의 관심에 맞춰 다듬고 추적할 질문을 선택합니다.",
    detail: "환자분이 물어볼 질문에서 우리 병원의 AI 노출 확인이 시작됩니다.",
    chips: ["질문 추천", "내용 수정", "추적 질문 선택"],
    href: "/dashboard/prompts",
    link: "핵심 질문 관리",
  },
  {
    title: "답변 속 위치를 발견.",
    label: "DISCOVER",
    description:
      "질문마다 실제 AI 답변을 열어보세요. 경쟁 병원을 추가하고 같은 답변에서의 등장률과 순위를 비교합니다.",
    detail:
      "어떤 말로 소개됐는지, 다른 병원도 함께 등장했는지 원문으로 확인합니다.",
    chips: ["답변 원문", "경쟁 병원 추가", "등장률 순위"],
    href: "/dashboard/competitors",
    link: "경쟁 병원 비교",
  },
];

export default function HomePage() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [platformIndex, setPlatformIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const loggedIn = _hasHydrated && isAuthenticated;
  const startHref = loggedIn ? "/dashboard" : "/register";
  const startLabel = loggedIn ? "대시보드 열기" : "14일 무료로 시작";
  const example = examples[questionIndex];
  const step = steps[activeStep];

  return (
    <div className="min-h-screen bg-[#f1f1eb] text-[#141512]">
      <PublicHeader loggedIn={loggedIn} />
      <main>
        <section id="hero-section" className="border-b border-[#141512]">
          <div className="bg-[#ff5d2a]">
            <div className="relative mx-auto grid max-w-[1440px] grid-cols-[1fr_auto] items-end gap-3 px-5 py-6 sm:px-8 sm:py-7 lg:px-10">
              <div>
                <p className="mb-4 font-mono text-[8px] font-semibold tracking-[0.14em] sm:text-[9px]">
                  PATIENT / AI SEARCH OBSERVATORY
                </p>
                <SignalWordmark className="text-[clamp(5.5rem,12vw,10.5rem)]" />
              </div>
              <div className="flex flex-col items-end self-stretch justify-between border-l border-[#141512]/35 pl-4 sm:pl-8">
                <span
                  aria-hidden="true"
                  className="font-mono text-2xl font-light leading-none"
                >
                  +
                </span>
                <div className="hidden text-right font-mono text-[9px] leading-5 sm:block">
                  PROFILE
                  <br />
                  QUESTION
                  <br />
                  RESPONSE
                </div>
                <SignalMark className="!h-10 !w-10 !bg-[#141512] !text-[#d0ff43] sm:!h-14 sm:!w-14" />
              </div>
            </div>
          </div>
          <div className="mx-auto max-w-[1440px] px-5 pb-7 pt-6 sm:px-8 lg:px-10">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-[23px] font-semibold leading-tight tracking-[-0.06em] sm:text-3xl">
                  우리 병원, AI는 뭐라고 할까.
                </h1>
                <p className="mt-2 text-xs leading-6 text-[#606259]">
                  병원 소개에서 핵심 질문으로. 질문마다 실제 답변과 경쟁 병원의
                  위치를 확인하세요.
                </p>
              </div>
              <Link
                href={startHref}
                className="group inline-flex shrink-0 items-center justify-between gap-7 bg-[#141512] px-5 py-3.5 text-xs font-semibold text-[#f1f1eb] transition-colors hover:bg-[#d0ff43] hover:text-[#141512]"
              >
                {startLabel}
                <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-1" />
              </Link>
            </div>

            <div
              id="signal-demo"
              className="mt-6 scroll-mt-6 border border-[#141512]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#141512] px-4 py-3 text-[#f1f1eb] sm:px-5">
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.1em]">
                  <span className="h-2 w-2 bg-[#d0ff43]" />
                  QUESTION / RESPONSE
                </div>
                <p className="text-[10px] text-[#f1f1eb]/65">
                  설명용 예시 · 실제 측정 결과가 아닙니다
                </p>
              </div>
              <div className="grid lg:grid-cols-[0.9fr_1.6fr]">
                <div className="min-w-0 border-b border-[#141512] lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between border-b border-[#d4d6cb] px-4 py-3 sm:px-5">
                    <span className="text-xs font-semibold">질문 목록</span>
                    <span className="font-mono text-[9px] text-[#74766d]">
                      SELECT A QUESTION
                    </span>
                  </div>
                  <div
                    className="grid grid-cols-3 lg:grid-cols-1"
                    role="group"
                    aria-label="예시 질문 선택"
                  >
                    {examples.map((item, index) => (
                      <button
                        key={item.label}
                        type="button"
                        aria-pressed={questionIndex === index}
                        onClick={() => setQuestionIndex(index)}
                        className={`relative flex min-h-[88px] flex-col items-start gap-3 border-b border-r border-[#d4d6cb] px-3 py-4 text-left transition-colors last:border-r-0 sm:px-5 lg:min-h-[101px] lg:flex-row lg:gap-4 lg:border-r-0 ${questionIndex === index ? "bg-[#d0ff43]" : "hover:bg-white"}`}
                      >
                        <span className="shrink-0 font-mono text-[10px]">
                          Q.0{index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold sm:text-sm">
                            {item.label}
                          </span>
                          <span className="mt-2 hidden text-[11px] leading-5 text-[#606259] lg:block">
                            {item.question}
                          </span>
                        </span>
                        {questionIndex === index && (
                          <span
                            className="absolute bottom-3 right-3 h-1.5 w-1.5 bg-[#141512] lg:bottom-auto lg:right-4 lg:top-5"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="hidden px-5 py-4 text-[10px] leading-5 text-[#74766d] lg:block">
                    질문을 선택하면 연결된 답변이 바뀝니다.
                    <br />
                    아래 답변은 사용 방식 설명을 위해 작성했습니다.
                  </p>
                </div>
                <div className="min-w-0 bg-white">
                  <div
                    className="flex border-b border-[#141512]"
                    role="group"
                    aria-label="예시 플랫폼 선택"
                  >
                    {demoPlatforms.map((platform, index) => (
                      <button
                        key={platform}
                        type="button"
                        aria-pressed={platformIndex === index}
                        onClick={() => setPlatformIndex(index)}
                        className={`flex-1 border-r border-[#d4d6cb] px-2 py-3 text-[11px] font-semibold transition-colors last:border-r-0 sm:px-5 sm:text-xs ${platformIndex === index ? "bg-[#ff5d2a] text-[#141512]" : "text-[#606259] hover:bg-[#f1f1eb]"}`}
                      >
                        <span className="mr-2 hidden font-mono text-[9px] sm:inline">
                          0{index + 1}
                        </span>
                        {platform}
                      </button>
                    ))}
                  </div>
                  <div
                    key={`${questionIndex}-${platformIndex}`}
                    className="signal-panel-enter"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <div className="border-b border-[#d4d6cb] px-5 py-4 sm:px-7">
                      <p className="font-mono text-[9px] text-[#74766d]">
                        Q.0{questionIndex + 1} / {example.tag}
                      </p>
                      <h2 className="mt-2 text-[17px] font-medium leading-7 tracking-[-0.035em] sm:text-xl">
                        {example.question}
                      </h2>
                    </div>
                    <div className="px-5 py-5 sm:px-7">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[10px] font-semibold">
                          <CornerDownRight className="h-3.5 w-3.5" />
                          {demoPlatforms[platformIndex]} · 답변 예시
                        </span>
                        <span className="font-mono text-[9px] text-[#74766d]">
                          DEMO TEXT
                        </span>
                      </div>
                      <p className="mt-4 min-h-[108px] text-[13px] leading-[1.9] text-[#4d5047] sm:min-h-[100px] sm:text-sm">
                        {example.answers[platformIndex]}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#d4d6cb] pt-4 text-[10px] text-[#606259]">
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3 w-3" />
                          질문과 답변 연결
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3 w-3" />
                          플랫폼별 확인
                        </span>
                        <span className="ml-auto font-mono text-[#74766d]">
                          READ / COMPARE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#606259]">
              <span>질문과 플랫폼을 눌러 답변 탐색을 체험해 보세요.</span>
              <span>카드 등록 없이 14일 무료 체험</span>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-6 px-5 py-12 sm:px-8 lg:px-10 lg:py-16"
        >
          <div className="mx-auto max-w-[1360px]">
            <Reveal className="mb-7 flex flex-col justify-between gap-4 border-b border-[#141512] pb-6 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-[9px] font-semibold tracking-[0.15em]">
                  WORKING INDEX / 01—03
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
                  소개를 연결하고, 질문을 좁히고, 답변을 읽고.
                </h2>
              </div>
              <span className="font-mono text-xs">PATIENT SIGNAL</span>
            </Reveal>
            <div className="grid border border-[#141512] lg:grid-cols-[0.75fr_1.25fr]">
              <div
                className="border-b border-[#141512] lg:border-b-0 lg:border-r"
                role="group"
                aria-label="사용 단계 선택"
              >
                {steps.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    aria-pressed={activeStep === index}
                    className={`flex w-full items-center gap-4 border-b border-[#141512] px-5 py-5 text-left transition-colors last:border-b-0 sm:px-6 ${activeStep === index ? "bg-[#141512] text-[#d0ff43]" : "hover:bg-[#d0ff43]"}`}
                  >
                    <span className="font-mono text-[10px]">0{index + 1}</span>
                    <span className="flex-1 text-sm font-semibold">
                      {item.title}
                    </span>
                    <span className="hidden font-mono text-[9px] sm:block">
                      {item.label}
                    </span>
                    <ArrowRight
                      className={`h-4 w-4 transition-transform ${activeStep === index ? "translate-x-1" : ""}`}
                    />
                  </button>
                ))}
              </div>
              <div className="flex flex-col justify-between bg-white p-5 sm:p-7">
                <div
                  key={activeStep}
                  className="signal-panel-enter"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="bg-[#ff5d2a] px-2.5 py-1.5 font-mono text-[10px] font-semibold">
                      FILE / 0{activeStep + 1}
                    </span>
                    <span className="font-mono text-[10px] text-[#74766d]">
                      {step.label}
                    </span>
                  </div>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-[#4d5047]">
                    {step.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                    {step.chips.map((chip) => (
                      <span
                        key={chip}
                        className="border-b border-[#d4d6cb] pb-1 text-[10px] text-[#606259]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <Link
                  href={loggedIn ? step.href : "/register"}
                  className="mt-6 flex w-fit items-center gap-7 text-xs font-semibold underline decoration-[#d4d6cb] underline-offset-4 hover:decoration-[#141512]"
                >
                  {step.link}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] text-[#606259]">
              <span className="mr-auto font-mono text-[9px]">PLATFORMS</span>
              {platforms.map((platform) => (
                <span key={platform}>{platform}</span>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[#74766d]">
              지원 플랫폼과 측정 주기는 플랜에 따라 다릅니다.
            </p>
          </div>
        </section>

        <section className="border-y border-[#141512] bg-[#d0ff43] px-5 py-9 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[1360px] gap-7 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-mono text-[9px] font-semibold tracking-[0.12em]">
                READY TO OPEN YOUR WORKSPACE?
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
                우리 병원의 질문부터 시작하세요.
              </h2>
            </div>
            <div>
              <Link
                href={startHref}
                className="group flex items-center justify-between gap-12 bg-[#141512] px-5 py-3.5 text-xs font-semibold text-[#f1f1eb] hover:bg-[#ff5d2a] hover:text-[#141512]"
              >
                {startLabel}
                <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-1" />
              </Link>
              {!loggedIn && (
                <a
                  href={HUB_SSO_START_URL}
                  className="mt-4 flex items-center gap-2 text-[11px] font-medium"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Patient Hub 계정으로 연결
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
