import { useId, useRef, useState } from 'react';
import './tabs.css';

const panels = [
    {
        label: '概要',
        text: '進行中のプロジェクトを確認できます。',
        detail: '進行中 12件・確認待ち 3件',
    },
    {
        label: '分析',
        text: 'プロジェクトの作業量を集計しています。',
        detail: '今週の完了タスク 24件',
    },
    { label: 'レポート', text: '保存したレポートを確認できます。', detail: '月次レポート 4件' },
    { label: '設定', text: '表示や通知の設定を確認できます。', detail: '通知は有効です。' },
];

export default function Tabs() {
    const [active, setActive] = useState(0);
    const id = useId();
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    return (
        <section className="fs-tabs" aria-label="プロジェクト情報">
            <div role="tablist" aria-label="表示する情報" className="fs-tabs-list">
                {panels.map((panel, index) => (
                    <button
                        key={panel.label}
                        ref={(element) => {
                            tabs.current[index] = element;
                        }}
                        role="tab"
                        id={`${id}-tab-${index}`}
                        aria-controls={`${id}-panel-${index}`}
                        aria-selected={active === index}
                        tabIndex={active === index ? 0 : -1}
                        onClick={() => setActive(index)}
                        onKeyDown={(event) => {
                            const next =
                                event.key === 'ArrowRight'
                                    ? (index + 1) % panels.length
                                    : event.key === 'ArrowLeft'
                                      ? (index + panels.length - 1) % panels.length
                                      : event.key === 'Home'
                                        ? 0
                                        : event.key === 'End'
                                          ? panels.length - 1
                                          : null;
                            if (next !== null) {
                                event.preventDefault();
                                setActive(next);
                                tabs.current[next]?.focus();
                            }
                        }}
                    >
                        {panel.label}
                    </button>
                ))}
            </div>
            {panels.map((panel, index) => (
                <div
                    key={panel.label}
                    role="tabpanel"
                    tabIndex={0}
                    hidden={active !== index}
                    id={`${id}-panel-${index}`}
                    aria-labelledby={`${id}-tab-${index}`}
                    className="fs-tabs-panel"
                >
                    <h2>{panel.label}</h2>
                    <p>{panel.text}</p>
                    <p>{panel.detail}</p>
                </div>
            ))}
        </section>
    );
}
