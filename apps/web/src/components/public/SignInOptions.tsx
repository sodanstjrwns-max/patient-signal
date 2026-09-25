import { ArrowRight } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.patientsignal.kr/api";
const hubAuthorizeParams = new URLSearchParams({
  service: "signal",
  redirect_uri: "https://patientsignal.kr/auth/hub/callback",
});
const googleParams = new URLSearchParams({
  next: `/sso/authorize?${hubAuthorizeParams.toString()}`,
});
const GOOGLE_SIGN_IN_URL = `https://hub.patientfunnel.kr/api/auth/google?${googleParams.toString()}`;

export default function SignInOptions({
  registering = false,
}: {
  registering?: boolean;
}) {
  return (
    <div className="mt-8 space-y-3">
      <a
        href={GOOGLE_SIGN_IN_URL}
        className="group flex min-h-14 w-full items-center justify-center gap-3 border border-[#ff6a24] bg-[#181b1e] px-4 py-3 text-sm font-bold text-[#f5f5ef] transition-colors hover:bg-[#281a13] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9ff43]"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
            <path
              fill="#4285F4"
              d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.41h11a9.41 9.41 0 0 1-4.08 6.18v5.14h6.62c3.87-3.56 6.07-8.8 6.07-14.81Z"
            />
            <path
              fill="#34A853"
              d="M24 44c5.51 0 10.13-1.83 13.51-4.73l-6.62-5.14c-1.83 1.23-4.17 1.97-6.89 1.97-5.32 0-9.83-3.59-11.44-8.43H5.73v5.3A20 20 0 0 0 24 44Z"
            />
            <path
              fill="#FBBC05"
              d="M12.56 27.67a12.01 12.01 0 0 1 0-7.34v-5.3H5.73a20 20 0 0 0 0 17.94l6.83-5.3Z"
            />
            <path
              fill="#EA4335"
              d="M24 11.9c3 0 5.68 1.03 7.8 3.06l5.85-5.85A19.68 19.68 0 0 0 24 4 20 20 0 0 0 5.73 15.03l6.83 5.3C14.17 15.49 18.68 11.9 24 11.9Z"
            />
          </svg>
        </span>
        {registering ? "Google로 시작하기" : "Google로 로그인"}
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 text-[#ff6a24] transition-transform motion-safe:group-hover:translate-x-1"
        />
      </a>
      <a
        href={`${API_BASE_URL}/auth/hub`}
        className="flex min-h-12 w-full items-center justify-center gap-2.5 border border-[#30343a] bg-[#111315] px-4 py-3 text-xs font-semibold text-[#c0c4c7] transition-colors hover:bg-[#181b1e] hover:text-[#f5f5ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9ff43]"
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center bg-[#30343a] font-numeric text-[10px] font-bold text-[#f5f5ef]"
        >
          PH
        </span>
        Patient Hub 계정으로 로그인
      </a>
    </div>
  );
}
