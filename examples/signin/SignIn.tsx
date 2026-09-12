import { useId, useState } from 'react';
import './signin.css';

export default function SignIn() {
    const [submitted, setSubmitted] = useState(false);
    const id = useId();
    return (
        <main className="fs-signin">
            <div className="fs-signin-window">
                <aside className="fs-signin-art" aria-hidden="true">
                    <b>still.</b>
                    <div className="fs-signin-rings">
                        <i />
                        <i />
                        <i />
                        <i />
                    </div>
                    <h1>サインイン</h1>
                    <p>メールアドレスでログインします。</p>
                </aside>
                <form
                    className="fs-signin-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setSubmitted(true);
                    }}
                >
                    <span aria-hidden="true" className="fs-signin-symbol">
                        ✳
                    </span>
                    <h2>ログイン</h2>
                    <p>メールアドレスを入力してください。</p>
                    <label htmlFor={id}>メールアドレス</label>
                    <input
                        id={id}
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                        onChange={() => setSubmitted(false)}
                    />
                    <button type="submit">
                        ログインリンクを送信 <span aria-hidden="true">↗</span>
                    </button>
                    <p role="status" className="fs-signin-status">
                        {submitted
                            ? '入力を確認しました。デモのためメールは送信していません。'
                            : 'この画面は入力操作を試すデモです。'}
                    </p>
                </form>
            </div>
        </main>
    );
}
