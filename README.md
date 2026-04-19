# タイトラボ

なろう・カクヨムなどのランキング作品タイトルを「解剖」して眺める Web アプリです。トークンの出現数をクラウド表示し、任意のタイトル案をランキング語彙と照らした診断も行えます。

- **本番**: [https://taitolabo.vercel.app](https://taitolabo.vercel.app)
- **ソース**: [github.com/tabisurushosai/taitolabo](https://github.com/tabisurushosai/taitolabo)

## プロジェクト概要

| ページ | 説明 |
|--------|------|
| `/` | ランキング由来のトークンクラウドと、語の共起・該当作品の閲覧 |
| `/diagnose` | 入力タイトルをコーパスと照合したスコア・類似作品・推奨語の表示（任意で AI 寸評） |
| `/kaihatsu` | JSON の検証・**Upstash Redis への保存**・データセット一覧・削除（パスワード保護） |

ランキング本体のデータは **Upstash Redis**（Vercel の環境変数 `KV_REST_API_URL` / `KV_REST_API_TOKEN`）に保存され、ランタイムで読み書きします。リポジトリの `data/rankings/` は使用しません。

## ローカル開発のセットアップ

Upstash Redis を使うため、ローカルにも環境変数が必要です。

初回のみ、ターミナルで以下を実行してください：

```bash
npm i -g vercel         # Vercel CLI をグローバルインストール
vercel login            # ブラウザが開くのでログイン
vercel link             # taitolabo プロジェクトにリンク
vercel env pull .env.local    # 環境変数をローカルに取得
```

以降、環境変数に変更があれば `vercel env pull .env.local` で再同期してください。

## ローカルで動かす手順

1. **Node.js**（推奨: LTS）を用意する。
2. 依存関係をインストールする。

   ```bash
   npm install
   ```

3. 開発サーバーを起動する。

   ```bash
   npm run dev
   ```

4. ブラウザで [http://localhost:3000](http://localhost:3000) を開く。

本番に近い動作で試す場合:

```bash
npm run build
npm run start
```

## データ追加フロー

1. ランキングの PDF を **Claude Opus** に渡し、ルートの **[PDF_TO_JSON_PROMPT.md](./PDF_TO_JSON_PROMPT.md)** に記載のプロンプトで `RankingDataset` 形式の JSON を生成する。
2. 生成した JSON を **`/kaihatsu`**（パスワード入力後）に貼り、「検証する」で形式を確認する。
3. 「**本番に保存する**」で Upstash Redis に保存する（トップページ・診断は数秒以内に反映されます）。
4. 削除は **`/kaihatsu` の一覧**から行うか、必要なら同じキー（`source` + `date`）を上書き保存する。

詳細なスキーマとトークン抽出の注意は `PDF_TO_JSON_PROMPT.md` を参照してください。

## 環境変数（任意）

ルートに `.env.local` を作成し、**AI 寸評**（`/diagnose` の「AI寸評」）を有効にする場合は次を設定します。

```
ANTHROPIC_API_KEY=sk-ant-...
```

未設定でもサイト全体および診断の数値・類似表示は動作します。寸評だけオフの表示になります。

## Vercel へのデプロイ

公開URLを **`https://taitolabo.vercel.app`** にしたい場合、Vercel 上の **プロジェクト名を `taitolabo`** にします（`*.vercel.app` のサブドメインはプロジェクト名と一致します）。**`taitolabo` が既に他ユーザーに取られている場合は別名**にするか、独自ドメインを割り当ててください。

1. リポジトリを GitHub 等に push する。
2. [Vercel](https://vercel.com) にログインし、**Add New… → Project** でリポジトリをインポートする。
3. **Project Name** を **`taitolabo`** に設定する（初回のみ。空きがなければ別名にするか、チーム・スペル違いを検討する）。
4. **Framework Preset** は **Next.js** のまま **Deploy** する。完了後の本番URLは `https://taitolabo.vercel.app` になる。
5. 既に別名でデプロイ済みの場合は、ダッシュボードの **Settings → General → Project Name** を `taitolabo` に変更できる（未使用名のときのみ）。
6. **Upstash for Redis** を Vercel に接続し、`KV_REST_API_URL` / `KV_REST_API_TOKEN` などが本番・プレビュー環境に設定されていることを確認してください。
7. （任意）**Settings → Environment Variables** に `ANTHROPIC_API_KEY` を設定すると、本番でも AI 寸評が有効になります。未設定なら寸評はオフです。
8. `package.json` の `build` / `start` は Next.js 標準のままで問題ありません。

CLI でデプロイする場合は、初回リンク時にプロジェクト名を `taitolabo` に指定します。

```bash
npx vercel login
npx vercel link   # Project name: taitolabo
npx vercel --prod
```

## AI 寸評の料金の目安

モデルは **Claude Haiku 4.5**（`claude-haiku-4-5-20251001`）を想定しています。おおざっぱに、**1 回の寸評あたり数円未満〜数十銭程度**（入力・出力トークン量による）で、**月に約 1,000 回叩いても数百円〜千円未満に収まりやすい**オーダーです。正確な単価は [Anthropic の料金ページ](https://www.anthropic.com/pricing) を参照してください。
