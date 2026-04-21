export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">{title}</h2>
      {sub && <p className="mt-1 text-[13px] text-[#6E6E73]">{sub}</p>}
    </div>
  );
}
