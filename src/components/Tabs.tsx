"use client";
import { cn } from "@/lib/utils";

type Tab = { id: string; label: string; icon?: string };

export function Tabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex p-1 bg-white rounded-full border border-[#D2D2D7]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "px-5 py-2 text-[14px] font-semibold rounded-full transition-colors min-h-[44px] min-w-[120px]",
            active === t.id ? "bg-[#0071E3] text-white" : "text-[#1D1D1F] hover:bg-[#F5F5F7]"
          )}
        >
          <span className="mr-1.5">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
