import { useState } from 'react';
import './samples.css';

export default function Login() {
    const [sent, setSent] = useState(false);
    return (
        <div className="sample sample-login">
            <div className="login-window">
                <div className="login-art">
                    <span className="sample-wordmark">still.</span>
                    <div className="login-sculpture" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                    </div>
                    <div>
                        <h1>
                            Find your
                            <br />
                            own rhythm.
                        </h1>
                        <p>A calmer space for your everyday.</p>
                    </div>
                    <small>MAKE SPACE FOR WHAT MATTERS.</small>
                </div>
                <form
                    className="login-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setSent(true);
                    }}
                >
                    <span className="login-symbol" aria-hidden="true">
                        ✳
                    </span>
                    <h2>Welcome back.</h2>
                    <p>A little focus goes a long way.</p>
                    <label htmlFor="login-email">Email address</label>
                    <input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        onChange={() => setSent(false)}
                    />
                    <button type="submit">
                        Send a sign-in link <span aria-hidden="true">↗</span>
                    </button>
                    <small aria-live="polite">
                        {sent
                            ? 'Demo complete. No email was sent.'
                            : 'No password. One less thing to remember.'}
                    </small>
                    <div className="login-divider">A MOMENT FOR YOURSELF</div>
                </form>
            </div>
        </div>
    );
}
