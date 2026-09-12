# Formshelf

スクリーンショットやURLをもとに実装したReact UIを保存し、別プロジェクトからMCPで検索・取得する個人用Webアプリです。

## 起動

Node.js **24.14以降の24系**を使用します。SQLiteはNode標準の `node:sqlite` を使うため、現行NodeではExperimentalWarningが出ます。

```sh
npm ci
npx playwright install chromium  # 登録・テスト時の撮影に使用
npm run collection -- init
npm run build
npm start
```

<http://127.0.0.1:5173> を開きます。終了は `Ctrl+C`。開発時は `npm run dev`、ポートを変える場合は `PORT=5174 npm start` を使います。

最初は空のコレクションです。既存モック6件と、入力経路の検証用2件は必要に応じて登録できます。

```sh
npm run collection -- import-samples
npm run collection -- register examples/tabs
npm run collection -- register examples/signin
```

既存サンプルのコード・画像はリポジトリに残しています。登録済みの同一内容には同じIDを返し、上書きしません。登録後は画面の「更新」を押します。

## 保存先

既定は `~/.local/share/formshelf`。Web、登録コマンド、MCPのすべてが作業ディレクトリによらず同じ保存先を使います。変更する場合は、各起動環境で `FORMSHELF_DATA_DIR` に同じ絶対パスを設定します。

```text
formshelf/
  collection.sqlite       メタデータ・検索情報
  collection.sqlite-wal   使用中のSQLite一時ファイル（存在する場合）
  collection.sqlite-shm
  objects/<UI ID>/         完成済みのソース、素材、参照画像、manifest.json
    generated/            プレビューHTMLと撮影したサムネイル
  staging/                登録途中・失敗時の作業領域
```

実データはGit管理外です。収集作業はGit除外済みの `collection-work/` に置けます。DBだけをコピーせず、下記のバックアップコマンドを使用してください。

## UIを追加する

このプロジェクトのエージェントへスクショまたはURLと、残したい部分・操作を渡します。URLだけの場合は対象部分を確認し、開けない場合はスクショ／録画を使います。エージェントがここでReact実装を作り、登録コマンドを実行します。アプリ内でのAI生成・自動クロールはありません。

```sh
npm run collection -- register collection-work/my-ui
```

入力例は [URL由来のタブ](examples/tabs/manifest.json) と [画像由来のサインイン画面](examples/signin/manifest.json)、入力形式・失敗時の対処は [登録手順](docs/registration.md) を参照してください。

登録時だけビルドとブラウザ撮影を行います。描画失敗・期限超過・ファイル不備があれば検索結果に公開しません。保存後は元の作業フォルダや元URLに依存せず表示・取得できます。

## 別プロジェクトから呼び出す

次のコマンドで、現在のNode実行パス・MCP入口・保存先を含む接続例を表示します。クライアントの設定ファイルは変更しません。

```sh
npm run --silent collection -- config
```

出力の `mcpServers.formshelf` を、利用するMCPクライアントの接続設定に合わせて登録します。接続方式は `stdio` です。コマンドを直接確認するときは `npm run mcp` を使えますが、JSON-RPCの入力を待つため通常はクライアントから起動します。

| ツール | 内容 |
| --- | --- |
| `search_ui` | 名前・タグ・特徴・IDのAND検索。`query`、`kind`、`category`、`offset`、`limit`。最大50件、既定10件。 |
| `get_ui` | `id`を指定し、説明・入口・依存バージョン・ファイル一覧を取得。 |
| `read_ui_file` | `id`、登録済み`path`、`offset`、`length`。最大64KiBのbase64を返す。 |

依頼例: 「Formshelfからミニマルなタブを探して、この画面に使って」。IDが分かれば「Formshelfの `ui-…` を取得して、このプロジェクトへ移植して」と指定できます。

エージェントは候補を選び、`get_ui`で入口と依存を確認し、必要なソース・CSS・素材を`read_ui_file`で取得します。`nextOffset`が`null`になるまでbase64をバイト列として連結し、全体の`sha256`を照合します。`generated/`は閲覧用で、移植には通常不要です。依存は移植先の既存バージョンと比較してから適用します。

MCPは検索・読み取り専用です。Webサーバーやブラウザを起動する必要はありません。接続中はNodeプロセスが1つ動き、クライアントの切断・終了で停止します。新しいUIの実装・登録はコレクション側で行います。

## 表示と実行の範囲

一覧は静止画像のみ、詳細のプレビューは選択中の1件だけを実行します。閉じる／参照画像・コードへ切り替えるとiframeを破棄します。コードは選択したファイルの先頭64KiBを表示し、全体はダウンロードできます。

保存したUIは `sandbox="allow-scripts allow-forms"` のiframe内で動かします。フォームの入力検証・イベントは使えますが、実際の送信はCSPの `form-action 'none'` で遮断します。親画面のCSPでiframe自身のHTTP(S)遷移も遮断します。登録時の撮影も新規ブラウザ環境で同じ隔離を使い、通信を遮断します。外部APIや認証に依存するUIはサンプルデータに置き換えて登録します。

サーバーは127.0.0.1でのみ待ち受けます。認証・他ユーザー共有・外部公開は対象外です。

## バックアップと復元

```sh
npm run collection -- backup /absolute/new-backup
FORMSHELF_DATA_DIR=/absolute/new-collection npm run collection -- restore /absolute/new-backup
FORMSHELF_DATA_DIR=/absolute/new-collection npm run collection -- doctor
```

バックアップはSQLiteのスナップショットと、そこから参照される完成済みファイルをコピーします。バックアップ先・復元先は**まだ存在しないディレクトリ**を指定してください。既存の保存先を上書きしません。途中で失敗したコピー先は再利用せず、新しい場所へやり直します。

`doctor`はDBの整合性、欠落・改変ファイル、未完了・未登録の保存物を診断します。自動削除・自動修復は行いません。失敗した登録は元の入力を修正して再実行できます。残った`staging/`や未登録物は、内容と必要性を確認してから別の場所へ退避してください。

## 検証

```sh
npm run build
npm test
```

Node標準のテスト機能を使います。保存・同時登録・失敗時の未公開・取得範囲・実MCP・バックアップ復元に加え、Playwrightで別プロジェクトへの移植と実データの画面操作を確認します。macOSの`ps`を使うプロセス検証を含みます。テスト用データは一時ディレクトリ、画像とメモリ実測はGit除外済みの`artifacts/`へ出力します。

実測値・検証範囲は [本実装の検証記録](docs/implementation-verification.md)、合意した範囲は [実装プラン](docs/implementation-plan.md) に記載しています。
