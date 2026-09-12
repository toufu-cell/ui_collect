import type { CSSProperties } from 'react';

const paths = {
    search: 'm21 21-4.5-4.5 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
    plus: 'M12 5v14M5 12h14',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    external: 'M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
    close: 'm6 6 12 12M6 18 18 6',
    copy: 'M9 9h12v12H9zM15 5V3H3v12h2',
    check: 'm5 12 4 4L19 6',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    box: 'M4 5h16v14H4zM4 10h16M9 10v9',
    monitor: 'M3 3h18v14H3zM12 17v4M8 21h8',
    phone: 'M7 2h10v20H7zM11 18h2',
    code: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
    image: 'M3 3h18v18H3zM3 16l5-5 5 5 3-3 5 5M15 7h.01',
    link: 'm10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 2 2-2a4 4 0 0 0-6-6l-2 2',
    chevron: 'm8 10 4 4 4-4',
    book: 'M12 5v16M12 5C9 2 4 3 2 4v16c3-2 7-2 10 1 3-3 7-3 10-1V4c-2-1-7-2-10 1',
} as const;

export function Icon({
    name,
    size = 18,
    style,
}: {
    name: keyof typeof paths;
    size?: number;
    style?: CSSProperties;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={style}
        >
            <path d={paths[name]} />
        </svg>
    );
}
