import { useState } from 'react';
import './samples.css';

export default function Pricing() {
    const [yearly, setYearly] = useState(false);
    const [selected, setSelected] = useState(false);
    return (
        <div className="sample sample-pricing">
            <div className="pricing-card">
                <div className="pricing-top">
                    <span className="sample-wordmark">
                        folio<span>®</span>
                    </span>
                    <span className="pricing-label">FOR INDEPENDENT MINDS</span>
                </div>
                <h1>
                    A little space.
                    <br />
                    Endless possibilities.
                </h1>
                <p>Your next great idea starts here.</p>
                <div className="billing-switch" aria-label="支払い周期">
                    <button
                        aria-pressed={!yearly}
                        onClick={() => {
                            setYearly(false);
                            setSelected(false);
                        }}
                    >
                        Monthly
                    </button>
                    <button
                        aria-pressed={yearly}
                        onClick={() => {
                            setYearly(true);
                            setSelected(false);
                        }}
                    >
                        Yearly <span>−20%</span>
                    </button>
                </div>
                <div className="price">
                    <strong>${yearly ? '12' : '15'}</strong>
                    <span>/ month</span>
                </div>
                <ul>
                    <li>Unlimited projects</li>
                    <li>Your own custom domain</li>
                    <li>A home for everything you make</li>
                </ul>
                <button className="pricing-cta" onClick={() => setSelected(!selected)}>
                    {selected ? '✓ Plan selected' : 'Make room for your ideas'}
                    <span aria-hidden="true">↗</span>
                </button>
                <small aria-live="polite">
                    {selected
                        ? 'Demo only — no payment is made.'
                        : 'No commitments. Just possibilities.'}
                </small>
            </div>
        </div>
    );
}
