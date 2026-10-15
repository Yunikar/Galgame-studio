/**
 * 通用 Tab 条
 */
type Item<T extends string> = {
  key: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  items: Item<T>[];
  value: T;
  onChange: (key: T) => void;
  /** 是否占满宽度等分 */
  fill?: boolean;
};

export default function Tabs<T extends string>({ items, value, onChange, fill }: Props<T>) {
  return (
    <div className={`flex items-center gap-1 ${fill ? 'w-full' : ''}`}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${fill ? 'flex-1 justify-center' : ''} ${
              active
                ? 'bg-brand-600 font-medium text-white'
                : 'text-ink-soft hover:bg-slate-100 hover:text-ink'
            }`}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span className={`text-[10px] ${active ? 'text-white/70' : 'text-ink-faint'}`}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
