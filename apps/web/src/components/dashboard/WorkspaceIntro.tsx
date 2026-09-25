export function WorkspaceIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="grid gap-4 border-b border-[#DEE4D9] pb-7 pt-2 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-10">
      <div>
        <p className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#778378]"><span className="h-1.5 w-1.5 bg-[#36765A]" />{eyebrow}</p>
        <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.055em] text-[#15231B] sm:text-[36px]">{title}</h2>
      </div>
      <p className="max-w-md text-xs leading-6 text-[#778378] lg:justify-self-end">{description}</p>
    </div>
  );
}
