import { useState } from 'react';
import './samples.css';

export default function Dashboard() {
    const [period, setPeriod] = useState('week');
    const monthly = period === 'month';
    const values = monthly ? [31, 48, 40, 63, 57, 81, 95] : [35, 57, 43, 77, 61, 93, 72];
    return (
        <div className="sample sample-dashboard">
            <div className="dashboard-window">
                <aside className="dashboard-sidebar">
                    <b>o.</b>
                    <span className="active" aria-label="Overview">
                        ▦
                    </span>
                    <span aria-hidden="true">◫</span>
                    <span aria-hidden="true">▥</span>
                    <span aria-hidden="true">⚙</span>
                    <span className="dashboard-avatar">J</span>
                </aside>
                <div className="dashboard-main">
                    <div className="dashboard-heading">
                        <div>
                            <small>YOUR WORK, AT A GLANCE</small>
                            <h1>
                                Overview<span>↗</span>
                            </h1>
                        </div>
                        <label>
                            <span className="sample-sr-only">集計期間</span>
                            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                                <option value="week">This week</option>
                                <option value="month">This month</option>
                            </select>
                        </label>
                    </div>
                    <div className="dashboard-stats">
                        <div>
                            <span>Total revenue</span>
                            <strong>
                                ${monthly ? '42,890' : '12,840'}
                                <small>↗ 12.8%</small>
                            </strong>
                        </div>
                        <div>
                            <span>Active projects</span>
                            <strong>
                                {monthly ? '32' : '12'}
                                <small>+ 3 new</small>
                            </strong>
                        </div>
                    </div>
                    <div className="dashboard-chart">
                        <div>
                            <b>Revenue over time</b>
                            <span>● Revenue</span>
                        </div>
                        <div
                            className="chart-bars"
                            role="img"
                            aria-label={`${monthly ? 'Monthly' : 'Weekly'} revenue bar chart`}
                        >
                            {values.map((value, index) => (
                                <div key={index}>
                                    <div style={{ height: `${value}%` }} />
                                    <small>
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                                    </small>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="dashboard-project">
                        <div>
                            <b>Recent projects</b>
                            <span>STATUS</span>
                        </div>
                        <p>
                            <span>
                                <i />
                                Website redesign
                            </span>
                            <em>In progress</em>
                        </p>
                        <p>
                            <span>
                                <i />
                                Brand guidelines
                            </span>
                            <em className="done">Completed</em>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
