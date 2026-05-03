"use client";

export type DateRange = { from: string; to: string };

const PRESETS: { label: string; days: number }[] = [
  { label: "過去7日", days: 7 },
  { label: "過去14日", days: 14 },
  { label: "過去30日", days: 30 },
  { label: "過去90日", days: 90 },
];

function todayJst(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.format(new Date());
  return new Date(`${parts}T00:00:00+09:00`);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function lastNDaysRange(n: number): DateRange {
  const today = todayJst();
  const start = new Date(today);
  start.setDate(today.getDate() - (n - 1));
  return { from: isoDate(start), to: isoDate(today) };
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-3">
      <span className="text-[13px] font-medium text-[#1D1D1F]">📅 期間</span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value.from}
          max={value.to}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#D2D2D7] bg-white text-[#1D1D1F] min-h-[36px]"
        />
        <span className="text-[#6E6E73] text-sm">〜</span>
        <input
          type="date"
          value={value.to}
          min={value.from}
          max={isoDate(todayJst())}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#D2D2D7] bg-white text-[#1D1D1F] min-h-[36px]"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const r = lastNDaysRange(p.days);
          const active = r.from === value.from && r.to === value.to;
          return (
            <button
              key={p.label}
              onClick={() => onChange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border min-h-[36px] ${
                active
                  ? "bg-[#0071E3] text-white border-[#0071E3]"
                  : "bg-white text-[#1D1D1F] border-[#D2D2D7] hover:bg-[#F5F5F7]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <span className="text-[11px] text-[#6E6E73] ml-auto">
        ※ Google広告とInstagramは直近30日固定スクレイプ。期間を絞ると30日内のサブセットが表示されます
      </span>
    </div>
  );
}
