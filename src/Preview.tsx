import { Suspense, useEffect } from 'react';
import { pieces } from './catalog';

export function Preview({ id }: { id: string }) {
    const piece = pieces.find((item) => item.id === id);
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && window.parent !== window) {
                window.parent.postMessage(
                    { type: 'ui-collect:close-preview' },
                    window.location.origin,
                );
            }
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, []);
    if (!piece)
        return (
            <main className="preview-error">
                <h1>UIが見つかりません</h1>
                <p>指定したIDを確認してください。</p>
                <a href="/">コレクションへ</a>
            </main>
        );
    const Component = piece.component;
    return (
        <Suspense
            fallback={
                <p className="preview-loading" role="status">
                    プレビューを読み込んでいます…
                </p>
            }
        >
            <Component />
        </Suspense>
    );
}
