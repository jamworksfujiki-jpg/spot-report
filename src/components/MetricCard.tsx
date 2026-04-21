import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  sub?: string;
  icon?: React.ReactNode;
  className?: string;
};

export function MetricCard({ label, value, delta, deltaTone = "neutral", sub, icon, className }: Props) {
  const toneClass =
    deltaTone === "positive" ? "text-[#30D158]" :
    deltaTone === "negative" ? "text-[#FF3B30]" :
    "text-[#6E6E73]";
  return (
    <div className={cn("metric-card", className)}>
      <div className="flex items-start justify-between">
        <p className="text-[13px] text-[#6E6E73] font-medium">{label}</p>
        {icon && <div className="text-[#0071E3]">{icon}</div>}
      </div>
      <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#1D1D1F]">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-[12px]">
        {delta && <span className={cn("font-semibold", toneClass)}>{delta}</span>}
        {sub && <span className="text-[#6E6E73]">{sub}</span>}
      </div>
    </div>
  );
}
