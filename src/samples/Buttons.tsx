import { useState } from 'react';
import './samples.css';

export default function Buttons() {
    const [saved, setSaved] = useState(false);
    const [following, setFollowing] = useState(false);
    const [liked, setLiked] = useState(false);
    return (
        <div className="sample sample-buttons">
            <div className="buttons-board">
                <div className="buttons-heading">
                    <span>SMALL DETAILS, BIG DIFFERENCE</span>
                    <h1>Feels good to click.</h1>
                </div>
                <div className="buttons-row">
                    <span>01 / ACTION</span>
                    <button
                        className="sample-primary-button"
                        onClick={() => setSaved(!saved)}
                        aria-pressed={saved}
                    >
                        {saved ? '✓ Saved' : 'Save to collection'}
                        <span aria-hidden="true">{saved ? '✓' : '↗'}</span>
                    </button>
                </div>
                <div className="buttons-row">
                    <span>02 / TOGGLE</span>
                    <button
                        className="sample-follow-button"
                        onClick={() => setFollowing(!following)}
                        aria-pressed={following}
                    >
                        {following ? '✓ Following' : '+ Follow designer'}
                    </button>
                </div>
                <div className="buttons-row">
                    <span>03 / DELIGHT</span>
                    <button
                        className="sample-like-button"
                        aria-pressed={liked}
                        aria-label={liked ? 'いいねを取り消す' : 'いいね'}
                        onClick={() => setLiked(!liked)}
                    >
                        <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
                        {liked ? '25' : '24'}
                    </button>
                    <span className="buttons-hint">Go on. Give it a little love.</span>
                </div>
            </div>
        </div>
    );
}
