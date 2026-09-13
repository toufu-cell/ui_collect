# 公開UIの収集記録

2026-09-13に公開ページを閲覧・撮影し、日常のWebアプリで再利用しやすい部品12件を登録した。参照画像・URL・対象部分・日本語タグ・React＋TypeScriptとCSSを各パッケージに保存している。

## 登録したUI

| UI | 参照元 | 収録した操作・用途 | 固定ID |
| --- | --- | --- | --- |
| よくある質問 | [ui.shadcn.com](https://ui.shadcn.com/docs/components/radix/accordion) | 見出しをクリックまたはEnter/Spaceで開閉。1項目ずつ展開。 | `ui-6e6685e5-6945-4812-bcdf-276458fbc564` |
| 階層ナビゲーション | [daisyui.com](https://daisyui.com/components/breadcrumbs/) | 上位階層を選択し、現在地と表示内容を切り替え。 | `ui-eaa227b1-e14c-4047-9ebf-6d9b779a1f2e` |
| 左右のチャット吹き出し | [daisyui.com](https://daisyui.com/components/chat/) | 入力してローカル表示に追加。空文字は送信できない。 | `ui-ece60cfa-879b-4bc4-979b-0b27326b6ab8` |
| 検索コマンドメニュー | [ui.shadcn.com](https://ui.shadcn.com/docs/components/radix/command) | 文字入力で絞り込み、上下矢印で移動、Enterまたはクリックで選択。 | `ui-506b9397-cadf-469f-8177-156e9e0501e8` |
| 検索と選択ができるデータ表 | [ui.shadcn.com](https://ui.shadcn.com/docs/components/radix/data-table) | メール検索、並べ替え、行選択、全選択、ページ送り。 | `ui-cae5c493-9933-4a10-affd-e4760b6e917a` |
| プロフィール編集ダイアログ | [ui.shadcn.com](https://ui.shadcn.com/docs/components/radix/dialog) | 編集を開き、名前を変更して保存。キャンセル・Escapeで破棄。 | `ui-dfca6da5-4ecc-414e-9c51-5a6b17c592c0` |
| ページ番号ナビゲーション | [mantine.dev](https://mantine.dev/core/pagination/) | 番号・前へ・次へでページを切り替え。端では該当操作を無効化。 | `ui-838ff3b8-575a-4bf7-a604-bc995721f588` |
| 表示範囲の切り替え | [mantine.dev](https://mantine.dev/core/segmented-control/) | クリックまたは左右矢印で表示範囲を選択。 | `ui-1465f276-cbda-4ff2-bf13-6eb86e164622` |
| 数値のサマリー | [daisyui.com](https://daisyui.com/components/stat/) | 数値表示。APIや集計処理は含まない。 | `ui-304f4519-34a0-434a-80e4-5f601fcfd798` |
| 手順の進捗表示 | [daisyui.com](https://daisyui.com/components/steps/) | 次へ・戻るで現在のステップを更新。 | `ui-0aa29e99-7969-42dc-9336-097f8e9ee3c3` |
| 通知設定のスイッチ | [mantine.dev](https://mantine.dev/core/switch/) | クリック・Spaceで設定切り替え。現在のON/OFFを表示。 | `ui-ff831789-2819-40c9-9335-4f70a39f7aac` |
| 作業の履歴タイムライン | [mantine.dev](https://mantine.dev/core/timeline/) | 履歴の表示。操作要素は持たない。 | `ui-f7120ea8-6477-4fec-9ebb-1d9d98f58974` |

検索例: `モーダル`、`テーブル`、`通知`、`チャット`、`ページ送り`。MCPの`search_ui`で検索し、`get_ui`と`read_ui_file`で必要なコード・素材を取得できる。

## 保存と再利用

- 作業用パッケージは`collection-work/web-20260913/<slug>/`。登録済みの完成物は、設定されたFormshelf保存先にある。
- 各UIは`UI.tsx`、`ui.css`、`reference.png`、`manifest.json`を持つ。生成されたプレビューとサムネイルもMCPで取得できる。
- 依存はReact / ReactDOM 19.3.0。元のUIライブラリの導入は不要。default exportは引数なしで表示でき、データやコールバックのpropsはソースで確認できる。
- 収集データと検証用ファイルは既存のignore対象。Gitで共有するのはこの収集記録だけで、リポジトリをcloneしてもローカルDBの12件は自動配布されない。

## 再現範囲

公開ページの見た目と指定操作を参考にした独自実装で、元ライブラリのコード・API互換ではない。文言とデータは日本語のデモ用に変更している。

- データ表は検索・メール順ソート・選択・ページ送りを収録。参照元の列表示切り替えと行メニューは含めていない。
- プロフィール編集は初期状態でダイアログを表示する。`initiallyOpen={false}`で編集ボタンから開く形にできる。保存先や認証処理は接続していない。
- チャットの送信、通知設定、手順や階層の移動は画面内だけの状態変更。外部通信や永続保存は行わない。
- タイムラインと数値サマリーは表示用。数値サマリーは参照元の1指標の構造を3指標へ展開している。
- キーボード操作は各manifestの`interaction`に記載。参照画像の撮影日・対象・独自実装であることも各manifestに残している。

## 検証

- 全12件のTSXを既存TypeScriptで厳密に型検査した。通常のアプリ用tsconfigは作業フォルダを含まないため、ファイルを明示して実行した。
- Chromiumで全12件の主要操作を確認。検索の一致なし、ダイアログの入力検証・保存・Escapeキャンセル・フォーカス復帰、表の空状態・並べ替え・選択・ページ終端、各選択部品の状態変更、チャットの空送信防止を含む。
- 検索メニューのIME変換確定でコマンドが選択される問題を再現して修正した。`isComposing`と`keyCode: 229`のキーイベントでは選択せず、通常のEnterでは選択することを確認した。OSのIMEそのものを自動操作した検証ではない。
- 960pxと390pxのビューポートで撮影・目視確認した。ページ全体の横はみ出しなし。表は内部で横スクロールする。
- 別の見出しを持つページへ隔離iframeで表示し、親の見出しの色・文字サイズが維持されることを確認。UI実行時のJavaScript例外と外部通信は0件だった。
- MCPを収集プロジェクト外の作業ディレクトリから起動し、12件の検索・取得・日本語タグ検索を確認した。全72ファイルのサイズとSHA-256が一致した。
- MCPから取得したファイルだけを別フォルダに置き、全12件を再ビルド・型検査・操作確認した。検証用のReact依存は既存インストールを共有した。
- 実際のWeb一覧に12件が表示され、`collection doctor`は`ok: true, count: 12, issues: []`だった。
- Spec・Failure・Simplicityの独立3観点でPlan/Finalレビューを実施。型検査とIME対応の指摘を解消し、最終的に3観点ともblocking findingなし。

検証スクリプトは`collection-work/verify-web.ts`と`collection-work/verify-web-mcp.ts`、結果は`artifacts/web-collection-check/`、`artifacts/web-collection-transplant/`、`artifacts/web-collection-mcp.json`、`artifacts/collected-ui-gallery.png`にある。これらはこのPCの作業資料でありGitには含めない。

### Test decision

- 代表テスト: 既存`tests/workflow.test.ts`の「URL部品とスクショ画面を実MCPで別プロジェクトへ移植し、実データのWebを操作する」を参照し、今回の12件に対して上記の検証スクリプトを実行。
- 対応: 既存の取得・移植の確認方法を利用し、収集素材専用の検証を追加。アプリ本体・既存テストの変更はない。
- 検証追加の根拠: 保存UIは取得先で表示・操作できる必要がある。検索が選択に反映されない、保存やキャンセルが動かないなどの失敗は、既存のTabs/SignIn向けassertでは検出できない。
- 既存テストの統合・削除: 対象なし。アプリ本体と登録処理を変更していないため、既存の全テストは再実行していない。

Project Memoryは[収集と再利用の分離](project-memory/records/20260913-051200-separate-collection-and-reuse.md)を適用した。今回の収集は既存方針の適用であり、新しい設計判断の記録は作成していない。
