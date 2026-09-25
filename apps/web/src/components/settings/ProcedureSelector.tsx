"use client";

import { Check, Loader2, X } from "lucide-react";

export interface ProcedureOption {
  name: string;
  category?: string;
  isPopular?: boolean;
}

export function uniqueProcedures(values: string[] = []): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

interface ProcedureSelectorProps {
  options: ProcedureOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  specialtyName: string;
  loading?: boolean;
  error?: boolean;
  onRetry: () => void;
  disabled?: boolean;
  max?: number;
}

export function ProcedureSelector({
  options,
  selected,
  onChange,
  specialtyName,
  loading = false,
  error = false,
  onRetry,
  disabled = false,
  max = 3,
}: ProcedureSelectorProps) {
  // Saved/Hub names may not exist in the preset list. Keep their original meaning
  // and expose them as removable selections instead of silently occupying slots.
  const existingOptions = selected
    .filter((name) => !options.some((option) => option.name === name))
    .map((name) => ({ name, category: "existing", isPopular: false }));
  const visibleOptions = [...existingOptions, ...options];
  const full = selected.length >= max;

  const toggle = (name: string) => {
    if (disabled) return;
    if (selected.includes(name)) onChange(selected.filter((item) => item !== name));
    else if (!full) onChange([...selected, name]);
  };

  return (
    <div>
      <div className="mb-5 border-b border-[#30343a] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-[#f5f5ef]">선택한 핵심 진료</p>
          <span className="text-sm tabular-nums text-[#d9ff43]" aria-live="polite">
            {selected.length} / {max}개
          </span>
        </div>
        {selected.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="선택한 진료 해제">
            {selected.map((name) => (
              <button
                key={name}
                type="button"
                disabled={disabled}
                onClick={() => toggle(name)}
                aria-label={`${name} 선택 해제`}
                className="inline-flex min-h-11 items-center gap-2 border border-[#d9ff43] bg-[#181b1e] px-3 py-2 text-sm text-[#f5f5ef] transition-colors hover:bg-[#25292c] disabled:opacity-50"
              >
                {name}<X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#959c9f]">아래에서 주력 진료를 선택하세요.</p>
        )}
        <p id="procedure-selection-help" className="mt-3 text-xs leading-6 text-[#c0c4c7]" aria-live="polite">
          {selected.length > max
            ? `기존에 ${selected.length}개가 등록되어 있습니다. ${max}개 이하로 줄인 후 저장하세요.`
            : full
              ? `${max}개를 선택했습니다. 바꾸려면 선택한 항목의 × 또는 카드를 눌러 해제하세요.`
              : `${max - selected.length}개 더 선택할 수 있습니다. 선택한 카드를 다시 누르면 해제됩니다.`}
        </p>
      </div>
      <p className="mb-3 text-xs text-[#959c9f]">{specialtyName} 진료 항목</p>
      {loading && <p className="mb-3 flex items-center gap-2 text-sm text-[#c0c4c7]"><Loader2 className="h-4 w-4 animate-spin" />진료 항목을 불러오는 중입니다.</p>}
      {error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[#c0c4c7]">
          <span>추천 항목을 불러오지 못했습니다. 기존 선택은 유지됩니다.</span>
          <button type="button" onClick={onRetry} className="min-h-11 px-2 text-[#ff6a24] underline">다시 불러오기</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4" role="group" aria-label={`${specialtyName} 핵심 진료 선택`} aria-describedby="procedure-selection-help">
        {visibleOptions.map((option) => {
          const active = selected.includes(option.name);
          return (
            <button
              key={option.name}
              type="button"
              aria-pressed={active}
              aria-label={`${option.name}${active ? " 선택됨" : ""}`}
              disabled={disabled || (!active && full)}
              onClick={() => toggle(option.name)}
              className={`min-h-24 rounded-sm border p-3.5 text-left transition-colors disabled:cursor-not-allowed ${active ? "border-[#d9ff43] bg-[#181b1e] text-[#f5f5ef]" : "border-[#30343a] bg-[#111315] text-[#c0c4c7] hover:bg-[#181b1e] disabled:opacity-50"}`}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {option.name}{active && <Check className="h-4 w-4 shrink-0 text-[#d9ff43]" aria-hidden="true" />}
              </span>
              <span className="mt-2 block text-xs text-[#959c9f]">
                {option.category === "existing" ? "기존 선택 항목" : option.category === "core" ? "핵심 진료" : option.category === "cosmetic" ? "미용 진료" : "일반 진료"}
                {option.isPopular && " · 많이 선택"}
              </span>
            </button>
          );
        })}
      </div>
      {existingOptions.length > 0 && <p className="mt-3 text-xs leading-6 text-[#959c9f]">추천 목록과 이름이 다른 기존 진료도 그대로 표시했습니다. 필요 없는 항목은 선택 해제할 수 있습니다.</p>}
      {!loading && !error && visibleOptions.length === 0 && <p className="py-4 text-sm text-[#959c9f]">등록된 진료과의 추천 항목이 없습니다. 병원 기본 정보에서 진료과를 확인해주세요.</p>}
    </div>
  );
}
