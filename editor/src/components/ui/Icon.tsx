/**
 * 极简内联图标集（不引第三方图标库）
 * 统一 1.6 描边，尺寸由 className 控制。
 */
type IconProps = { name: string; className?: string };

/** 图标路径表：用 24x24 视口 */
const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M4 12.5l5 5L20 6.5',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6',
  copy: 'M9 9h10v12H9zM5 15V3h10',
  edit: 'M4 20h4l11-11-4-4L4 16v4z',
  play: 'M7 4.5v15l13-7.5z',
  stop: 'M6 6h12v12H6z',
  upload: 'M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 17v2.5h16V17',
  image: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  music: 'M9 18V5l10-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm10-2a3 3 0 11-6 0 3 3 0 016 0z',
  bell: 'M6 17V10a6 6 0 1112 0v7l1.5 2H4.5L6 17zM10 21h4',
  mic: 'M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  users: 'M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 21c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5M17 11a3 3 0 100-6M18 21c0-2.6-.6-4.4-1.6-5.6 3 .2 5.1 1.9 5.1 5.6',
  flag: 'M5 21V4h9l-1 3h7l-2 5 2 5h-9l1-3H5',
  flow: 'M4 5h6v5H4zM14 14h6v5h-6zM7 10v4a3 3 0 003 3h4',
  alert: 'M12 3l9 17H3zM12 9v5M12 17.5v.5',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.5',
  download: 'M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16',
  save: 'M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7',
  folder: 'M3 6h6l2 2h10v11H3z',
  refresh: 'M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M18 3v4h-4M6 21v-4h4',
  undo: 'M9 7L4 12l5 5M4 12h10a6 6 0 010 12h-1',
  redo: 'M15 7l5 5-5 5M20 12H10a6 6 0 000 12h1',
  layout: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 006 19.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 13H3a2 2 0 110-4h.1A1.6 1.6 0 004.7 6.4L4.6 6.3a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 3.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0021 10h.1a2 2 0 110 4H21a1.6 1.6 0 00-1.6 1z',
  eye: 'M12 5c5 0 9 4.5 9 7s-4 7-9 7-9-4.5-9-7 4-7 9-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.6 2.6 0 015 1c0 1.7-2.5 2-2.5 3.5M12 17v.5',
  film: 'M3 4h18v16H3zM7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4',
  external: 'M14 4h6v6M20 4l-8 8M18 14v6H4V6h6',
  chevron: 'M9 6l6 6-6 6',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
};

export function Icon({ name, className = 'h-4 w-4' }: IconProps) {
  const d = PATHS[name] ?? PATHS.info;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export default Icon;
