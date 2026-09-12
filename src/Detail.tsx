import { useEffect, useRef, useState } from 'react';
import type { Piece } from '../shared/types';
import { api, fileBytes } from './api';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function Detail({ piece, onClose }: { piece: Piece; onClose: () => void }) {
    const [tab, setTab] = useState<'preview' | 'reference' | 'code'>('preview');
    const [mobile, setMobile] = useState(false);
    const files = piece.files.filter((file) => !file.path.startsWith('generated/'));
    const [source, setSource] = useState('');
    const [fileIndex, setFileIndex] = useState(0);
    const [sourceError, setSourceError] = useState('');
    const [preview, setPreview] = useState<{ html: string; token: string } | null>(null);
    const [previewError, setPreviewError] = useState('');
    const [ready, setReady] = useState(false);
    const [copyState, setCopyState] = useState('');
    const frameRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (
                event.origin === 'null' &&
                event.source === frameRef.current?.contentWindow &&
                event.data?.token === preview?.token
            ) {
                if (event.data.type === 'formshelf:close') onClose();
                if (event.data.type === 'formshelf:ready') setReady(true);
                if (event.data.type === 'formshelf:error')
                    setPreviewError(`描画に失敗しました: ${event.data.message}`);
            }
        };
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, [onClose, preview]);

    useEffect(() => {
        setPreview(null);
        setPreviewError('');
        setReady(false);
        if (tab !== 'preview') return;
        const controller = new AbortController();
        api<{ html: string; token: string }>(`/api/ui/${piece.id}/preview`, controller.signal)
            .then(setPreview)
            .catch((error) => {
                if (!controller.signal.aborted) setPreviewError(error.message);
            });
        return () => controller.abort();
    }, [piece, tab]);

    useEffect(() => {
        if (tab !== 'preview' || ready || previewError) return;
        const timer = setTimeout(
            () =>
                setPreviewError(
                    'プレビューの起動を確認できませんでした。閉じて開き直してください。',
                ),
            30_000,
        );
        return () => clearTimeout(timer);
    }, [tab, ready, previewError]);

    useEffect(() => {
        setSource('');
        setSourceError('');
        if (tab !== 'code') return;
        const controller = new AbortController();
        const file = files[fileIndex];
        if (!/\.(tsx?|jsx?|css|json|md|svg|html)$/.test(file.path)) {
            setSource('バイナリファイルです。「ダウンロード」から取得できます。');
            return;
        }
        api<{ data: string; nextOffset: number | null }>(
            `/api/ui/${piece.id}/file?path=${encodeURIComponent(file.path)}`,
            controller.signal,
        )
            .then((result) => {
                const text = new TextDecoder().decode(
                    Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0)),
                );
                setSource(
                    text +
                        (result.nextOffset === null
                            ? ''
                            : '\n\n（先頭64KiBを表示。全体はダウンロードできます。）'),
                );
            })
            .catch((error) => {
                if (!controller.signal.aborted) setSourceError(error.message);
            });
        return () => controller.abort();
    }, [piece, tab, fileIndex]);

    async function download() {
        try {
            const file = files[fileIndex];
            const bytes = await fileBytes(piece.id, file.path);
            const url = URL.createObjectURL(
                new Blob([bytes], { type: 'application/octet-stream' }),
            );
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = file.path.split('/').pop()!;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            setSourceError(error instanceof Error ? error.message : '取得できませんでした。');
        }
    }

    async function copy(text: string, label: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopyState(`${label}をコピーしました`);
        } catch {
            setCopyState(
                'コピーできませんでした。表示されている文字を選択してコピーしてください。',
            );
        }
    }

    return (
        <Modal titleId="detail-title" onClose={onClose} className="detail-modal">
            <header className="detail-heading">
                <span className="eyebrow">{piece.name}</span>
                <h2 id="detail-title">{piece.title}</h2>
                <div className="detail-title-meta">
                    <span className="type-label">
                        <Icon name={piece.kind === 'screen' ? 'monitor' : 'box'} size={13} />
                        {piece.kind === 'screen' ? '画面全体' : '部品'}
                    </span>
                    <span>{piece.category}</span>
                    <code>{piece.id}</code>
                </div>
            </header>
            <div className="detail-layout">
                <div className="detail-main">
                    <div className="preview-toolbar">
                        <div className="view-switch" aria-label="表示内容">
                            {(
                                [
                                    { id: 'preview', label: 'プレビュー', icon: 'monitor' },
                                    { id: 'reference', label: '参照画像', icon: 'image' },
                                    { id: 'code', label: 'コード', icon: 'code' },
                                ] as const
                            ).map((item) => (
                                <button
                                    key={item.id}
                                    aria-pressed={tab === item.id}
                                    onClick={() => setTab(item.id)}
                                >
                                    <Icon name={item.icon} size={15} />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        {tab === 'preview' && (
                            <div className="device-switch" aria-label="プレビュー幅">
                                <button
                                    aria-label="デスクトップ幅"
                                    title="デスクトップ幅"
                                    aria-pressed={!mobile}
                                    onClick={() => setMobile(false)}
                                >
                                    <Icon name="monitor" size={17} />
                                </button>
                                <button
                                    aria-label="モバイル幅"
                                    title="モバイル幅"
                                    aria-pressed={mobile}
                                    onClick={() => setMobile(true)}
                                >
                                    <Icon name="phone" size={17} />
                                </button>
                            </div>
                        )}
                    </div>
                    {tab === 'preview' && (
                        <div className={`preview-stage ${mobile ? 'is-mobile' : ''}`}>
                            {previewError ? (
                                <p role="alert">{previewError}</p>
                            ) : preview ? (
                                <iframe
                                    ref={frameRef}
                                    srcDoc={preview.html}
                                    sandbox="allow-scripts allow-forms"
                                    referrerPolicy="no-referrer"
                                    title={`${piece.title}の操作プレビュー`}
                                />
                            ) : (
                                <p role="status">プレビューを読み込んでいます…</p>
                            )}
                        </div>
                    )}
                    {tab === 'reference' && (
                        <div className="reference-stage">
                            <img
                                src={`/api/ui/${piece.id}/reference`}
                                alt={`${piece.title}の参照画像`}
                                onError={() =>
                                    setSourceError(
                                        '参照画像を読み込めません。collection doctorで保存ファイルを確認してください。',
                                    )
                                }
                            />
                            <p>{piece.source.target}</p>
                            {sourceError && <p role="alert">{sourceError}</p>}
                        </div>
                    )}
                    {tab === 'code' && (
                        <div className="code-stage">
                            {files.length ? (
                                <>
                                    <div className="code-toolbar">
                                        <label className="sr-only" htmlFor="source-file">
                                            表示するファイル
                                        </label>
                                        <select
                                            id="source-file"
                                            value={fileIndex}
                                            onChange={(e) => setFileIndex(Number(e.target.value))}
                                        >
                                            {files.map((file, index) => (
                                                <option value={index} key={file.path}>
                                                    {file.path}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            className="text-button"
                                            onClick={() => copy(source, '表示内容')}
                                        >
                                            <Icon name="copy" size={14} />
                                            コピー
                                        </button>
                                        <button className="text-button" onClick={download}>
                                            ダウンロード
                                        </button>
                                    </div>
                                    <pre
                                        tabIndex={0}
                                        aria-label={`${files[fileIndex].path}のソースコード`}
                                    >
                                        <code>{sourceError || source || '読み込んでいます…'}</code>
                                    </pre>
                                </>
                            ) : (
                                <p role="status">
                                    {sourceError
                                        ? 'コードを読み込めませんでした。ページを再読み込みしてください。'
                                        : 'コードを読み込んでいます…'}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="preview-note">
                        <span className="live-dot" />
                        {tab === 'preview'
                            ? '実際に操作できます'
                            : tab === 'reference'
                              ? '登録時の参照画像'
                              : 'プレビューに使用しているソース'}
                        <span>{tab === 'preview' ? 'ESC で閉じる' : 'React + TypeScript'}</span>
                    </div>
                </div>
                <aside className="detail-aside">
                    <div>
                        <h3>このUIについて</h3>
                        <p>{piece.description}</p>
                    </div>
                    <div>
                        <h3>気に入ったところ</h3>
                        <p>{piece.note}</p>
                    </div>
                    <div>
                        <h3>試せること</h3>
                        <p>{piece.interaction}</p>
                    </div>
                    <div className="detail-tags">
                        {piece.tags.map((tag) => (
                            <span key={tag}>#{tag}</span>
                        ))}
                    </div>
                    <div className="reuse-section">
                        <h3>このUIを使う</h3>
                        <p>エージェントにIDを渡して、使いたいUIを指定できます。</p>
                        <button className="copy-id" onClick={() => copy(piece.id, 'ID')}>
                            <code>{piece.id}</code>
                            <span>
                                <Icon name="copy" size={14} />
                                IDをコピー
                            </span>
                        </button>
                        <dl>
                            <dt>実装</dt>
                            <dd>React + TypeScript</dd>
                            <dt>依存</dt>
                            <dd>
                                {Object.entries(piece.dependencies).map(([name, version]) => (
                                    <div key={name}>
                                        {name} {version}
                                    </div>
                                ))}
                            </dd>
                            <dt>参照元</dt>
                            <dd>
                                {piece.source.url ? (
                                    <a
                                        href={piece.source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        元ページを開く
                                    </a>
                                ) : piece.source.type === 'sample' ? (
                                    'オリジナルサンプル'
                                ) : (
                                    '提供された画像・録画'
                                )}
                                <p>{piece.source.target}</p>
                            </dd>
                        </dl>
                        <small>MCPのsearch_uiで探し、get_uiで取得できます。</small>
                    </div>
                </aside>
            </div>
            <div className="copy-feedback" role="status">
                {copyState}
            </div>
        </Modal>
    );
}
