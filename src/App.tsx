import { useEffect, useRef, useState } from 'react';
import type { Piece, SearchResult } from '../shared/types';
import { api } from './api';
import { Detail } from './Detail';
import { Icon } from './Icon';
import { Modal } from './Modal';

export function App() {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('すべて');
    const [kind, setKind] = useState('all');
    const [sort, setSort] = useState('catalog');
    const [selected, setSelected] = useState<Piece | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const [result, setResult] = useState<SearchResult | null>(null);
    const [offset, setOffset] = useState(0);
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        setOffset(0);
    }, [query, category, kind, sort]);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        const timer = setTimeout(() => {
            api<SearchResult>(
                `/api/ui?${new URLSearchParams({ query, category, kind, sort, offset: String(offset), limit: '36' })}`,
                controller.signal,
            )
                .then(setResult)
                .catch((error) => {
                    if (!controller.signal.aborted) setError(error.message);
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoading(false);
                });
        }, 150);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [query, category, kind, sort, offset, revision]);
    const filtered = result?.items ?? [];
    const categories = result?.categories ?? [];
    const resetFilters = () => {
        setQuery('');
        setCategory('すべて');
        setKind('all');
    };
    const hasFilters = query.trim() !== '' || category !== 'すべて' || kind !== 'all';

    return (
        <>
            <a className="skip-link" href="#collection">
                コレクションへ移動
            </a>
            <header className="site-header">
                <a className="brand" href="/" aria-label="Formshelf ホーム">
                    <span className="brand-mark" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                    </span>
                    <span>
                        formshelf<span className="brand-period">.</span>
                    </span>
                </a>
                <nav aria-label="メイン">
                    <a href="#collection" className="nav-active">
                        コレクション
                    </a>
                    <button onClick={() => setShowGuide(true)}>
                        使い方
                        <Icon name="external" size={12} />
                    </button>
                </nav>
                <div className="header-right">
                    <span className="personal-label">
                        <span />
                        個人用
                    </span>
                    <span className="avatar" aria-label="個人用コレクション">
                        K
                    </span>
                </div>
            </header>
            <main id="collection" className="collection-main">
                <section className="collection-heading">
                    <h1>UIコレクション</h1>
                    <button className="primary-button" onClick={() => setShowGuide(true)}>
                        <Icon name="plus" size={17} />
                        UIの追加方法
                    </button>
                </section>
                <div className="collection-controls">
                    <div className="kind-tabs" aria-label="UIの種類">
                        {[
                            { id: 'all', label: 'すべてのUI', icon: 'grid' },
                            { id: 'component', label: '部品', icon: 'box' },
                            { id: 'screen', label: '画面全体', icon: 'monitor' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                aria-pressed={kind === item.id}
                                onClick={() => setKind(item.id)}
                            >
                                <Icon name={item.icon as 'grid' | 'box' | 'monitor'} size={16} />
                                {item.label}
                                <span>
                                    {item.id === 'all'
                                        ? (result?.stats.total ?? 0)
                                        : (result?.stats[item.id as 'component' | 'screen'] ?? 0)}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="search-field">
                        <Icon name="search" size={17} />
                        <label className="sr-only" htmlFor="collection-search">
                            UIを検索
                        </label>
                        <input
                            ref={searchRef}
                            id="collection-search"
                            type="search"
                            placeholder="名前、タグ、IDで検索"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        {query && (
                            <button
                                aria-label="検索をクリア"
                                onClick={() => {
                                    setQuery('');
                                    searchRef.current?.focus();
                                }}
                            >
                                <Icon name="close" size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="filter-row">
                    <div className="category-filters" aria-label="カテゴリ">
                        {['すべて', ...categories].map((item) => (
                            <button
                                key={item}
                                aria-pressed={category === item}
                                onClick={() => setCategory(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                    <label className="sort-control">
                        <span className="sr-only">並び順</span>
                        <select value={sort} onChange={(event) => setSort(event.target.value)}>
                            <option value="catalog">登録順</option>
                            <option value="reverse">登録順（逆順）</option>
                            <option value="name">名前順</option>
                        </select>
                        <Icon name="chevron" size={13} />
                    </label>
                </div>
                <div className="results-line">
                    <p role="status">
                        <strong>{result?.total ?? 0}</strong> 件のUI
                        {hasFilters && <span> / 全 {result?.stats.total ?? 0} 件</span>}
                    </p>
                    {hasFilters ? (
                        <button className="text-button" onClick={resetFilters}>
                            絞り込みを解除
                            <Icon name="close" size={12} />
                        </button>
                    ) : (
                        <button
                            className="text-button"
                            onClick={() => setRevision((value) => value + 1)}
                        >
                            更新
                        </button>
                    )}
                </div>
                {loading ? (
                    <p role="status" className="empty-state">
                        読み込んでいます…
                    </p>
                ) : error ? (
                    <div className="empty-state" role="alert">
                        <p>{error}</p>
                        <button
                            className="secondary-button"
                            onClick={() => setRevision((value) => value + 1)}
                        >
                            再読み込み
                        </button>
                    </div>
                ) : filtered.length ? (
                    <div className="collection-grid">
                        {filtered.map((piece) => (
                            <article className="piece-card" key={piece.id}>
                                <button
                                    className="piece-open"
                                    onClick={() => setSelected(piece)}
                                    aria-label={`${piece.title}を開く`}
                                >
                                    <div className="thumbnail" style={{ background: piece.color }}>
                                        <img
                                            src={`/api/ui/${piece.id}/thumbnail`}
                                            alt=""
                                            width="800"
                                            height="600"
                                            loading="lazy"
                                        />
                                        <span className="thumbnail-type">
                                            <Icon
                                                name={piece.kind === 'screen' ? 'monitor' : 'box'}
                                                size={12}
                                            />
                                            {piece.kind === 'screen' ? '画面全体' : '部品'}
                                        </span>
                                        <span className="thumbnail-open">
                                            <Icon name="arrow" size={19} />
                                        </span>
                                    </div>
                                    <div className="piece-caption">
                                        <div className="piece-name-row">
                                            <span className="piece-brand">
                                                {piece.name.split(' / ')[0]}
                                            </span>
                                            <code title={piece.id}>{piece.id.slice(0, 11)}</code>
                                        </div>
                                        <h2>{piece.title}</h2>
                                        <div className="piece-tags">
                                            {piece.tags.map((tag) => (
                                                <span key={tag}>{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                </button>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <Icon name="search" size={30} />
                        <h2>
                            {hasFilters ? '一致するUIがありません' : '登録済みのUIがありません'}
                        </h2>
                        <p>
                            {hasFilters
                                ? '別のキーワードで探すか、絞り込みを解除してください。'
                                : '「UIの追加方法」から登録の手順を確認できます。'}
                        </p>
                        <button className="secondary-button" onClick={resetFilters}>
                            すべてのUIを見る
                        </button>
                    </div>
                )}
                {!loading && !error && result && result.total > 36 && (
                    <div className="pagination" aria-label="ページ切り替え">
                        <button
                            className="secondary-button"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - 36))}
                        >
                            前へ
                        </button>
                        <span>
                            {offset + 1}〜{offset + filtered.length} / {result.total}
                        </span>
                        <button
                            className="secondary-button"
                            disabled={offset + 36 >= result.total}
                            onClick={() => setOffset(offset + 36)}
                        >
                            次へ
                        </button>
                    </div>
                )}
            </main>
            {selected && <Detail piece={selected} onClose={() => setSelected(null)} />}
            {showGuide && (
                <Modal
                    titleId="guide-title"
                    onClose={() => setShowGuide(false)}
                    className="guide-modal"
                >
                    <div className="guide-icon">
                        <Icon name="book" size={25} />
                    </div>
                    <h2 id="guide-title">UIの追加方法</h2>
                    <p className="guide-intro">
                        このプロジェクトのエージェントに、スクショまたはURLを渡して依頼します。
                    </p>
                    <ol className="guide-steps">
                        <li>
                            <span>1</span>
                            <div>
                                <h3>対象のUIを指定する</h3>
                                <p>
                                    「このカードの余白」「メニューの開き方」など、残したい部分を指定します。URLだけの場合は、対象部分を確認します。
                                </p>
                            </div>
                        </li>
                        <li>
                            <span>2</span>
                            <div>
                                <h3>動くUIとして実装する</h3>
                                <p>
                                    コレクションのプロジェクトで実装し、元画像・参照URLと一緒に残します。リンクを開けないときは、スクショや録画を使います。
                                </p>
                            </div>
                        </li>
                        <li>
                            <span>3</span>
                            <div>
                                <h3>別プロジェクトで再利用する</h3>
                                <p>
                                    別プロジェクトでは、保存済みのUIをエージェントに探してもらい、移植します。新しいUIの収集作業はここで行います。
                                </p>
                            </div>
                        </li>
                    </ol>
                    <div className="guide-example">
                        <span>依頼例</span>
                        <p>
                            「このURLの料金カードを追加して。
                            <br />
                            月払い・年払いの切り替えも残したい」
                        </p>
                    </div>
                    <p className="mock-notice">
                        登録後は「更新」で一覧に反映します。別プロジェクトからはMCPで検索・取得できるため、この画面を起動しておく必要はありません。
                    </p>
                    <button
                        className="primary-button guide-done"
                        onClick={() => setShowGuide(false)}
                    >
                        コレクションを見る
                        <Icon name="arrow" size={16} />
                    </button>
                </Modal>
            )}
        </>
    );
}
