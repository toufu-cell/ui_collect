import { useState } from 'react';
import './samples.css';

export default function Navigation() {
    const [active, setActive] = useState('Discover');
    const [open, setOpen] = useState(true);
    return (
        <div className="sample sample-navigation">
            <div className="navigation-canvas">
                <nav className="navigation-bar" aria-label="サンプルナビゲーション">
                    <b>forma</b>
                    <div>
                        {['Discover', 'Collections', 'About'].map((item) => (
                            <button
                                key={item}
                                aria-current={active === item ? 'page' : undefined}
                                onClick={() => setActive(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                    <button
                        className="navigation-user"
                        aria-expanded={open}
                        aria-controls="sample-user-menu"
                        onClick={() => setOpen(!open)}
                    >
                        JD
                    </button>
                </nav>
                <div className="navigation-body">
                    <span>YOUR DAILY DOSE OF GOOD DESIGN</span>
                    <h1>
                        {active === 'Discover' ? (
                            <>
                                Objects with
                                <br />a point of view.
                            </>
                        ) : active === 'Collections' ? (
                            <>
                                A few things
                                <br />
                                worth keeping.
                            </>
                        ) : (
                            <>
                                Made for
                                <br />
                                the curious.
                            </>
                        )}
                    </h1>
                    <p>A considered collection for a considered life.</p>
                </div>
                {open && (
                    <div className="navigation-menu" id="sample-user-menu">
                        <div>
                            <b>Jamie Davis</b>
                            <small>Personal workspace</small>
                        </div>
                        {['Your collection', 'Account settings', 'Sign out'].map((label, index) => (
                            <button
                                key={label}
                                onClick={() => {
                                    setActive(index === 0 ? 'Collections' : 'About');
                                    setOpen(false);
                                }}
                            >
                                <span aria-hidden="true">{['▦', '⚙', '↗'][index]}</span>
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
