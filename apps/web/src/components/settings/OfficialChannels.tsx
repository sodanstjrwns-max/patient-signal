"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BookOpen, Globe2, Instagram, Loader2, Save, Youtube } from "lucide-react";
import { hospitalApi } from "@/lib/api";
import { toast } from "@/hooks/useToast";

type ChannelField = "websiteUrl" | "blogUrl" | "instagramUrl" | "youtubeUrl";
type ChannelValues = Record<ChannelField, string>;
type HospitalChannels = { id: string } & Partial<Record<ChannelField, string | null>>;

const channels = [
  { field: "websiteUrl", label: "홈페이지", icon: Globe2, placeholder: "https://우리병원.com", note: "실제 운영 중인 홈페이지의 대표 주소" },
  { field: "blogUrl", label: "블로그", icon: BookOpen, placeholder: "https://blog.naver.com/병원아이디", note: "네이버·티스토리 등 병원 블로그의 주소" },
  { field: "instagramUrl", label: "인스타그램", icon: Instagram, placeholder: "https://www.instagram.com/병원아이디", note: "게시물 주소 대신 병원 프로필 주소" },
  { field: "youtubeUrl", label: "유튜브", icon: Youtube, placeholder: "https://www.youtube.com/@병원채널", note: "영상 주소 대신 병원 채널 주소" },
] as const;

function channelValues(hospital: HospitalChannels): ChannelValues {
  return Object.fromEntries(channels.map(({ field }) => [field, hospital[field] || ""])) as ChannelValues;
}

export function OfficialChannels({ hospital }: { hospital: HospitalChannels }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => channelValues(hospital));
  const [saved, setSaved] = useState(() => channelValues(hospital));
  const dirty = useRef(false);
  const hospitalRef = useRef(hospital.id);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hospitalRef.current !== hospital.id) {
      hospitalRef.current = hospital.id;
      dirty.current = false;
      setError("");
    }
    if (!dirty.current) {
      const current = channelValues(hospital);
      setDraft(current);
      setSaved(current);
    }
  }, [hospital]);

  const changed = channels.some(({ field }) => draft[field].trim() !== saved[field]);
  const registered = channels.filter(({ field }) => saved[field]).length;
  const mutation = useMutation({
    mutationFn: (values: ChannelValues) => hospitalApi.update(hospital.id, values),
    onSuccess: (response) => {
      const current = channelValues(response.data);
      dirty.current = false;
      setDraft(current);
      setSaved(current);
      setError("");
      queryClient.setQueryData(["hospital", hospital.id], (previous: any) => ({ ...previous, ...current }));
      queryClient.invalidateQueries({ queryKey: ["hospital", hospital.id] });
      queryClient.invalidateQueries({ queryKey: ["website-analysis", hospital.id] });
      queryClient.invalidateQueries({ queryKey: ["insights-sources", hospital.id] });
      toast.success("공식 채널 주소를 저장했습니다.");
    },
    onError: (failure: any) => {
      const message = failure?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "주소를 저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해주세요.");
    },
  });

  return (
    <section id="online-channels" className="grid scroll-mt-24 gap-6 border-t border-[#30343a] pt-8 lg:grid-cols-[230px_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#959c9f]">03 / OFFICIAL CHANNELS</p>
        <h2 className="font-display text-xl font-semibold tracking-tight">공식 채널 주소</h2>
        <p className="mt-3 text-xs leading-6 text-[#959c9f]">우리 병원의 홈페이지와 운영 채널을 등록하세요. 저장한 주소가 인용 분석에 연결됩니다.</p>
        <p className="mt-4 font-display text-3xl tracking-tight text-[#d9ff43]">{registered}<span className="ml-2 font-sans text-xs text-[#959c9f]">/ 4개 등록</span></p>
      </div>
      <form
        aria-label="공식 채널 주소 설정"
        onSubmit={(event) => {
          event.preventDefault();
          if (!changed || mutation.isPending) return;
          setError("");
          mutation.mutate(Object.fromEntries(channels.map(({ field }) => [field, draft[field].trim()])) as ChannelValues);
        }}
        className="min-w-0 border border-[#30343a] bg-[#111315] p-5 sm:p-7"
      >
        <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
          {channels.map(({ field, label, icon: Icon, placeholder, note }) => (
            <div key={field} className="min-w-0">
              <label htmlFor={`channel-${field}`} className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#f5f5ef]"><Icon className="h-4 w-4 text-[#ff6a24]" />{label} 주소</label>
              <input
                id={`channel-${field}`}
                value={draft[field]}
                onChange={(event) => { dirty.current = true; setDraft((current) => ({ ...current, [field]: event.target.value })); setError(""); }}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={2048}
                disabled={mutation.isPending}
                placeholder={placeholder}
                className="h-11 w-full min-w-0 border border-[#454a50] bg-[#08090a] px-3 text-sm text-[#f5f5ef] outline-none placeholder:text-[#727a7e] focus:border-[#ff6a24] disabled:opacity-60"
              />
              <p className="mt-2 text-[11px] leading-5 text-[#959c9f]">{note}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs leading-6 text-[#959c9f]">주소를 비우고 저장하면 등록이 해제됩니다. 계정 로그인이나 비밀번호는 필요하지 않습니다.</p>
        {error && <p role="alert" className="mt-4 border border-[#703c29] bg-[#251914] p-3 text-xs leading-6 text-[#ff9565]">{error}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#30343a] pt-5">
          <Link href="/dashboard/insights?tab=website" className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff9565] hover:underline">등록 채널 인용 분석 <ArrowUpRight className="h-4 w-4" /></Link>
          <div className="flex items-center gap-3">
            {changed && <button type="button" disabled={mutation.isPending} onClick={() => { dirty.current = false; setDraft(saved); setError(""); }} className="text-xs text-[#c0c4c7] hover:text-white disabled:opacity-40">되돌리기</button>}
            <button type="submit" disabled={!changed || mutation.isPending} className="inline-flex h-10 items-center gap-2 bg-[#ff6a24] px-4 text-sm font-bold text-[#08090a] hover:bg-[#ff9565] disabled:cursor-not-allowed disabled:opacity-40">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}채널 주소 저장
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
