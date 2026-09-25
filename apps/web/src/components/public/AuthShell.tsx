"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CornerDownRight } from "lucide-react";
import { PublicBrand, SignalWordmark } from "./PublicBrand";

const stages = [
  {
    label: "병원 소개",
    title: "병원 정보를 연결합니다.",
    description:
      "Patient Hub에서 가져온 소개를 확인하고 우리 병원의 지역, 진료, 특징을 직접 다듬으세요.",
    fields: ["Hub 소개 연결", "진료 · 지역 확인", "소개 직접 편집"],
    name: "PROFILE",
  },
  {
    label: "핵심 질문",
    title: "추적할 질문을 고릅니다.",
    description:
      "병원 정보를 바탕으로 추천한 질문을 검토하고 환자분의 관심에 맞춰 추적할 질문을 선택하세요.",
    fields: ["핵심 질문 추천", "질문 내용 수정", "추적 질문 선택"],
    name: "QUESTIONS",
  },
  {
    label: "실제 답변",
    title: "답변 속 근거를 읽습니다.",
    description:
      "플랫폼별 답변을 열어 우리 병원이 어떻게 소개됐는지 읽고 경쟁 병원의 등장률과 순위를 비교하세요.",
    fields: ["AI 답변 원문", "경쟁 병원 추가", "등장률 · 순위 비교"],
    name: "RESPONSES",
  },
];

export default function AuthShell({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: "login" | "register" | "recovery";
}) {
  const [activeStage, setActiveStage] = useState(0);
  const registering = mode === "register";
  const stage = stages[activeStage];

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f5ef]">
      <header className="border-b border-[#30343a] bg-[#08090a]">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <PublicBrand light />
          <Link
            href={registering ? "/login" : "/register"}
            className="group flex items-center gap-4 border border-[#ff6a24] px-4 py-2.5 text-xs font-semibold text-[#ff6a24] transition-colors hover:bg-[#ff6a24] hover:text-[#08090a]"
          >
            {registering ? "로그인" : "회원가입"}
            <ArrowRight className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:min-h-[calc(100vh-76px)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative flex flex-col border-b border-[#30343a] bg-[#08090a] px-5 py-5 sm:px-8 lg:justify-between lg:border-b-0 lg:border-r lg:p-10 xl:p-14">
          <div>
            <div className="flex items-center justify-between border-b border-[#30343a] pb-3">
              <span className="font-numeric text-[9px] tracking-[0.13em] text-[#959c9f]">
                PATIENT / AI SEARCH OBSERVATORY
              </span>
              <span
                aria-hidden="true"
                className="hidden h-1.5 w-1.5 bg-[#d9ff43] lg:block"
              />
            </div>
            <div className="flex items-end justify-between gap-5 pt-6 lg:block lg:pt-10">
              <SignalWordmark
                outlined
                className="text-[70px] text-[#ff6a24] sm:text-[82px] lg:text-[clamp(6rem,10vw,10rem)]"
              />
              <h2 className="pb-1 font-display text-[10px] leading-5 tracking-[-0.035em] lg:mt-7 lg:text-lg">
                병원의 검색 기록을 여는 곳.
              </h2>
            </div>
          </div>
          <div className="mt-12 hidden lg:block">
            <div
              className="flex border border-[#30343a]"
              role="group"
              aria-label="Patient Signal 사용 단계"
            >
              {stages.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={index === activeStage}
                  onClick={() => setActiveStage(index)}
                  className={`flex flex-1 items-center justify-center gap-2 border-r border-[#30343a] px-2 py-3.5 text-[11px] font-semibold transition-colors last:border-r-0 ${index === activeStage ? "bg-[#181b1e] text-[#ff6a24] shadow-[inset_0_-2px_0_#ff6a24]" : "bg-[#111315] text-[#959c9f] hover:text-[#f5f5ef]"}`}
                >
                  <span className="font-numeric text-[11px]">0{index + 1}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="border-x border-b border-[#30343a] bg-[#111315]">
              <div className="flex items-center justify-between border-b border-[#30343a] px-5 py-3">
                <span className="flex items-center gap-2 font-numeric text-[10px] text-[#959c9f]">
                  <CornerDownRight className="h-3 w-3" />
                  WORKSPACE / INDEX
                </span>
                <span className="font-numeric text-[11px] text-[#ff6a24]">
                  0{activeStage + 1}
                </span>
              </div>
              <div aria-live="polite">
                <div
                  key={activeStage}
                  className="signal-panel-enter min-h-[248px] p-5"
                >
                  <p className="font-numeric text-[12px] font-bold text-[#ff6a24]">
                    {stage.name}
                  </p>
                  <h3 className="mt-4 font-display text-base leading-7 tracking-[-0.035em]">
                    {stage.title}
                  </h3>
                  <p className="mt-3 text-[12px] leading-6 text-[#959c9f]">
                    {stage.description}
                  </p>
                  <div className="mt-5 border-t border-[#30343a]">
                    {stage.fields.map((field, index) => (
                      <div
                        key={field}
                        className="flex items-center justify-between border-b border-[#30343a] py-2 text-[10px]"
                      >
                        <span>{field}</span>
                        <span className="font-numeric text-[#959c9f]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between text-[9px] text-[#959c9f]">
              <span>
                {registering
                  ? "14일 무료 체험 · 카드 등록 없이"
                  : "BY PATIENT FUNNEL"}
              </span>
              <span aria-hidden="true" className="font-numeric text-[#ff6a24]">
                + — +
              </span>
            </div>
          </div>
        </aside>
        <main className="relative flex items-center justify-center bg-[#111315] px-6 py-10 sm:px-12 lg:px-14 lg:py-14">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 flex items-center justify-between border-b border-[#30343a] pb-3 font-numeric text-[10px]">
              <span className="flex items-center gap-2 text-[#959c9f]">
                <span className="h-1 w-1 bg-[#d9ff43]" />
                WORKSPACE ACCESS
              </span>
              <span className="font-bold tracking-[0.08em] text-[#ff6a24]">
                {registering
                  ? "NEW ACCOUNT"
                  : mode === "recovery"
                    ? "RECOVERY"
                    : "SIGN IN"}
              </span>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
