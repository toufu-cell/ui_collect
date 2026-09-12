import { useState } from 'react';
import './samples.css';

const commands = [
    { icon: '▤', label: 'Create a new document', hint: 'Start with a blank canvas', key: 'N' },
    { icon: '⌕', label: 'Search your workspace', hint: 'Find that one good idea', key: 'S' },
    { icon: '☆', label: 'Open favorites', hint: 'Your most important things', key: 'F' },
    { icon: '◷', label: 'View recent activity', hint: 'Pick up where you left off', key: 'R' },
];

export default function Command() {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState('');
    const visible = commands.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
    );
    return (
        <div className="sample sample-command">
            <div className="command-window">
                <div className="command-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                        aria-label="コマンドを検索"
                        placeholder="What would you like to do?"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <kbd>⌘ K</kbd>
                </div>
                <div className="command-list">
                    <p>SUGGESTED ACTIONS</p>
                    {visible.map((item) => (
                        <button key={item.key} onClick={() => setSelected(item.label)}>
                            <span className="command-icon" aria-hidden="true">
                                {item.icon}
                            </span>
                            <span>
                                <strong>{item.label}</strong>
                                <small>{item.hint}</small>
                            </span>
                            <kbd>{item.key}</kbd>
                        </button>
                    ))}
                    {!visible.length && <p>No matching commands.</p>}
                </div>
                <div className="command-footer">
                    <span aria-live="polite">
                        {selected
                            ? `✓ ${selected} · demo`
                            : 'A little less friction. A little more flow.'}
                    </span>
                    <span>↵ select</span>
                </div>
            </div>
            <span className="command-caption">ALWAYS ONE SHORTCUT AWAY.</span>
        </div>
    );
}
