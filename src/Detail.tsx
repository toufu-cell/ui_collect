import { useEffect, useRef, useState } from 'react';
import type { Piece } from './catalog';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function Detail({ piece, onClose }: { piece: Piece; onClose: () => void }) {
    const [tab, setTab] = useState<'preview' | 'reference' | 'code'>('preview');
    const [mobile, setMobile] = useState(false);
    const [files, setFiles] = useState<{ name: string; text: string }[]>([]);
    const [fileIndex, setFileIndex] = useState(0);
    const [sourceError, setSourceError] = useState(false);
    const [copyState, setCopyState] = useState('');
    const frameRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (
                event.origin === window.location.origin &&
                event.source === frameRef.current?.contentWindow &&
                event.data?.type === 'ui-collect:close-preview'
            )
                onClose();
        };
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, [onClose]);

    useEffect(() => {
        if (tab !== 'code') return;
        let active = true;
        Promise.all([piece.loadSource(), import('./samples/samples.css?raw')])
            .then(([source, css]) => {
                if (active)
                    setFiles([
                        { name: piece.sourceFile, text: source.default },
                        { name: 'samples.css', text: css.default },
                    ]);
            })
            .catch(() => {
                if (active) setSourceError(true);
            });
        return () => {
            active = false;
        };
    }, [piece, tab]);

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
                            <iframe
                                ref={frameRef}
                                src={`/?preview=${piece.id}`}
                                title={`${piece.title}の操作プレビュー`}
                            />
                        </div>
                    )}
                    {tab === 'reference' && (
                        <div className="reference-stage">
                            <img
                                src={`/thumbnails/${piece.id}.png`}
                                alt={`${piece.title}のサンプル参照画像`}
                            />
                            <p>
                                モック用に制作したUIの初期状態です。外部サイトから収集した画像ではありません。
                            </p>
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
                                                <option value={index} key={file.name}>
                                                    {file.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            className="text-button"
                                            onClick={() => copy(files[fileIndex].text, 'コード')}
                                        >
                                            <Icon name="copy" size={14} />
                                            コピー
                                        </button>
                                    </div>
                                    <pre
                                        tabIndex={0}
                                        aria-label={`${files[fileIndex].name}のソースコード`}
                                    >
                                        <code>{files[fileIndex].text}</code>
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
                              ? 'サンプルの参照画像'
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
                            <dd>React / CSS</dd>
                            <dt>参照元</dt>
                            <dd>オリジナルサンプル</dd>
                        </dl>
                        <small>MCPでの検索・取得は未接続です。</small>
                    </div>
                </aside>
            </div>
            <div className="copy-feedback" role="status">
                {copyState}
            </div>
        </Modal>
    );
}
