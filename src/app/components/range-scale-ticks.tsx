interface RangeScaleTicksProps {
  min: number;
  max: number;
  step?: number;
  className?: string;
}

export function RangeScaleTicks({ min, max, step = 1, className = '' }: RangeScaleTicksProps) {
  const values: number[] = [];
  for (let value = min; value <= max; value += step) values.push(value);

  return (
    <div
      aria-hidden="true"
      className={`mt-1 flex h-6 justify-between px-2 text-[11px] leading-none tabular-nums text-slate-600 ${className}`}
    >
      {values.map(value => (
        <span key={value} className="flex w-0 flex-col items-center gap-1">
          <span className="h-1.5 w-px shrink-0 bg-slate-300" />
          <span>{value}</span>
        </span>
      ))}
    </div>
  );
}
