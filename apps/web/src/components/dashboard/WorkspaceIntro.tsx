export function WorkspaceIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="grid gap-4 border-b border-[#dedee8] pb-7 pt-2 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-10">
      <div>
        <p className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#737382]"><span className="h-1.5 w-1.5 bg-[#5b4dff]" />{eyebrow}</p>
        <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.055em] text-[#111118] sm:text-[36px]">{title}</h2>
      </div>
      <p className="max-w-md text-xs leading-6 text-[#737382] lg:justify-self-end">{description}</p>
    </div>
  );
}
