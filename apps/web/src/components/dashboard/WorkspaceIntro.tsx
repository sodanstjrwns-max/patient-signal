export function WorkspaceIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="grid gap-4 border-b border-[#30343a] pb-5 pt-2 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-10">
      <div>
        <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#959c9f]"><span className="h-2 w-2 bg-[#ff6a24]" />{eyebrow}</p>
        <h2 className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.055em] text-[#f5f5ef] sm:text-[36px]">{title}</h2>
      </div>
      <p className="max-w-md text-xs leading-6 text-[#959c9f] lg:justify-self-end">{description}</p>
    </div>
  );
}
