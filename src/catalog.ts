import { lazy } from 'react';

export type Category =
    | 'カード'
    | 'ナビゲーション'
    | 'フォーム'
    | 'ダッシュボード'
    | 'インタラクション';
export type Piece = {
    id: string;
    title: string;
    name: string;
    kind: 'component' | 'screen';
    category: Category;
    tags: string[];
    description: string;
    note: string;
    interaction: string;
    color: string;
    sourceFile: string;
    component: ReturnType<typeof lazy>;
    loadSource: () => Promise<{ default: string }>;
};

export const pieces: Piece[] = [
    {
        id: 'UI-001',
        title: '料金カード',
        name: 'Folio / Pricing card',
        kind: 'component',
        category: 'カード',
        tags: ['ミニマル', '料金表', '切り替え'],
        color: '#f3e4ea',
        sourceFile: 'Pricing.tsx',
        description: '月払い・年払いを切り替えられる料金カードです。',
        note: '価格を大きく表示し、機能一覧と選択ボタンを縦に配置しています。',
        interaction:
            'Monthly / Yearlyで金額が切り替わります。プラン選択はデモで、決済は発生しません。',
        component: lazy(() => import('./samples/Pricing')),
        loadSource: () => import('./samples/Pricing.tsx?raw'),
    },
    {
        id: 'UI-002',
        title: 'コマンドメニュー',
        name: 'Orbit / Command menu',
        kind: 'component',
        category: 'ナビゲーション',
        tags: ['ダーク', '検索', 'メニュー'],
        color: '#25272d',
        sourceFile: 'Command.tsx',
        description: '検索欄から操作を絞り込めるコマンドメニューです。',
        note: '各項目のアイコン・説明・キー表記を揃え、背景色で選択状態を示しています。',
        interaction:
            '検索欄に「document」などを入力して絞り込み、コマンドを選択できます。実際のアプリ操作は行いません。',
        component: lazy(() => import('./samples/Command')),
        loadSource: () => import('./samples/Command.tsx?raw'),
    },
    {
        id: 'UI-003',
        title: 'ダッシュボード',
        name: 'Overview / Dashboard',
        kind: 'screen',
        category: 'ダッシュボード',
        tags: ['データ', 'グラフ', '管理画面'],
        color: '#e7edf6',
        sourceFile: 'Dashboard.tsx',
        description: '売上・グラフ・プロジェクトの状態を表示する画面です。',
        note: '集計値、棒グラフ、プロジェクト一覧を縦に配置しています。',
        interaction: 'This week / This monthを切り替えると、サンプルの数値とグラフが変わります。',
        component: lazy(() => import('./samples/Dashboard')),
        loadSource: () => import('./samples/Dashboard.tsx?raw'),
    },
    {
        id: 'UI-004',
        title: 'サインイン画面',
        name: 'Still / Sign in',
        kind: 'screen',
        category: 'フォーム',
        tags: ['ログイン', 'ミニマル', '入力'],
        color: '#e6ebe4',
        sourceFile: 'Login.tsx',
        description: 'メールアドレスを入力するサインイン画面です。',
        note: 'デスクトップは画像とフォームの2列、モバイルはフォームのみの1列で表示します。',
        interaction:
            'メール形式の入力検証と、送信後のデモメッセージを確認できます。メールは送信されません。',
        component: lazy(() => import('./samples/Login')),
        loadSource: () => import('./samples/Login.tsx?raw'),
    },
    {
        id: 'UI-005',
        title: 'プロフィールメニュー',
        name: 'Forma / Navigation',
        kind: 'component',
        category: 'ナビゲーション',
        tags: ['ドロップダウン', 'メニュー', 'ヘッダー'],
        color: '#f3eee5',
        sourceFile: 'Navigation.tsx',
        description: 'ユーザーアイコンから開閉するドロップダウンメニューです。',
        note: 'アイコンの下にメニューを配置し、影と境界線で背景と区別しています。',
        interaction:
            '右上のJDでメニューを開閉できます。ナビゲーションを選ぶと、サンプルの見出しが変わります。',
        component: lazy(() => import('./samples/Navigation')),
        loadSource: () => import('./samples/Navigation.tsx?raw'),
    },
    {
        id: 'UI-006',
        title: 'ボタンの状態切り替え',
        name: 'Details / Button states',
        kind: 'component',
        category: 'インタラクション',
        tags: ['ボタン', 'ホバー', '状態変化'],
        color: '#edeaf5',
        sourceFile: 'Buttons.tsx',
        description: '保存・フォロー・いいねの状態を切り替えるボタンです。',
        note: 'クリック後にラベル・色・数値が変化します。ホバー時にはボタンが少し移動します。',
        interaction:
            '3種類のボタンはクリックで状態を切り替えられます。状態はプレビューを閉じるとリセットされます。',
        component: lazy(() => import('./samples/Buttons')),
        loadSource: () => import('./samples/Buttons.tsx?raw'),
    },
];

export const categories: Category[] = [
    'カード',
    'ナビゲーション',
    'フォーム',
    'ダッシュボード',
    'インタラクション',
];
