# タイトラボ

なろう・カクヨムなどのランキング作品タイトルを「解剖」して眺める Web アプリです。トークンの出現数をクラウド表示し、任意のタイトル案をランキング語彙と照らした診断も行えます。

## プロジェクト概要

| ページ | 説明 |
|--------|------|
| `/` | ランキング由来のトークンクラウドと、語の共起・該当作品の閲覧 |
| `/diagnose` | 入力タイトルをコーパスと照合したスコア・類似作品・推奨語の表示（任意で AI 寸評） |
| `/admin/ingest` | PDF 等から作った JSON の検証と、保存用ファイル名・整形 JSON の出力（認証なし・個人利用向け） |

ランキング本体のデータはリポジトリ内の `data/rankings/*.json` として配布されます。Vercel 本番のサーバーからファイルへ直接書き込むことはせず、ローカルで JSON を追加してコミット・デプロイする運用です。

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
2. 生成した JSON を **`/admin/ingest`** に貼り、「検証する」で形式とサマリを確認する。
3. 検証が通ったら表示された整形 JSON をコピーし、提案ファイル名どおり **`data/rankings/{filename}.json`** に保存する（例: `narou_daily_total_2026-04-19.json`）。
4. **`git commit` → `git push`** し、ホスティング先へデプロイして本番に反映する。

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
6. **`data/` 以下**はリポジトリに含まれていればビルドに同梱され、ランキング JSON も本番で読み込めます。
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
