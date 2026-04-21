# タイトラボ

なろう・カクヨムなどのランキング作品タイトルを「解剖」して眺める Web アプリです。トークンの出現数をクラウド表示し、任意のタイトル案をランキング語彙と照らした診断も行えます。

- **本番**: [https://taitolabo.vercel.app](https://taitolabo.vercel.app)
- **ソース**: [github.com/tabisurushosai/taitolabo](https://github.com/tabisurushosai/taitolabo)

## プロジェクト概要

| ページ | 説明 |
|--------|------|
| `/` | ランキング由来のトークンクラウド、**共起ネットワーク**、**週次トレンド**（先週比で伸び／下がりのタイトル語）、**タイトル類似度チェック**（入力タイトルとコーパスの類似 TOP10）、語の共起・該当作品の閲覧 |
| `/diagnose` | 入力タイトルをコーパスと照合したスコア・類似作品・推奨語の表示（任意で AI 寸評） |
| `/kaihatsu` | **デバッグ・緊急用**: JSON の検証・Upstash Redis への保存・一覧・削除（パスワード保護）。本番の主経路は週次 GitHub Actions |

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

## ローカル開発用の環境変数設定

`vercel env pull` を使わず KV だけ手で入れる場合は、下記 **[データの更新方法 → 環境変数](#環境変数)** も参照し、**`.env.local.example`** を **`.env.local`** にコピーしてから値を埋めてください（[Environment Variables（Vercel Docs）](https://vercel.com/docs/projects/environment-variables)）。

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

## データの更新方法

### 自動更新（週次）

毎週**火曜 AM 5:00 JST**（UTC 月曜 20:00）に **GitHub Actions** が自動実行されます。なろう小説 API から最新のランキングを取得し、**Upstash Redis** に保存します。設定は [`.github/workflows/weekly-fetch.yml`](.github/workflows/weekly-fetch.yml) を参照してください。

**トレンド分析（トップの「今週のトレンド」）**は、週次ランキングを**先週分と比較できるだけのデータ**（実質 2 週間ぶん）が Redis に揃うと自動で有効になります。初回投入直後は「準備中」表示のままになることがあります。

**実行状況の確認:** [Weekly Narou Fetch · Actions](https://github.com/tabisurushosai/taitolabo/actions/workflows/weekly-fetch.yml)

週次ジョブが **上書き保存**する運用のため、Actions 側では `fetch-narou:push` に **`--skip-if-exists` は付けません**（常に最新取得を試みます）。手動デバッグ向けのオプションです。

### 手動実行

#### 方法1: ローカルから実行

初回のみ `npm install`（**kuromoji** の辞書は `node_modules/kuromoji/dict` に展開されます）。

```bash
npm run fetch-narou                               # scripts/output/narou/ に 15 JSON（ファイルのみ）
npm run fetch-narou -- --push                     # Redis にも投入
npm run fetch-narou -- --push --skip-if-exists      # 同日・同一キーが既にあれば該当ソースをスキップ（冪等）
```

実装上の詳細は `scripts/fetch-narou.ts`・`src/lib/data.ts` を参照してください。

#### 方法2: GitHub Actions から手動実行

**Actions** タブ → **Weekly Narou Fetch** → **Run workflow**

#### 方法3: Web UI から投入（デバッグ用）

**`/kaihatsu`** にアクセスし、JSON を貼り付けて「検証する」→「本番に保存する」（下記の補助機能）。

### 環境変数

ローカル（`.env.local`）および **GitHub Actions の Secrets** に、少なくとも次を設定します。

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

**Vercel** の本番・プレビューにも同じキーが必要です。ローカルへの取得が最も簡単な方法は次です。

```bash
npx vercel env pull .env.local
```

手で値を入れる場合は **Vercel** の **Settings → Environment Variables** からコピーし、GitHub の **Settings → Secrets and variables → Actions** に同名で登録してください。

### キャッシュ方針

[なろう小説 API の利用規約](https://dev.syosetu.com/man/api/)に従い、取得データのキャッシュは最長 **2 週間**です。**週次更新**でこの要件を満たしています。

### 失敗閾値

15 ソースのうち **2 つ以下**の失敗は警告のみでジョブは**成功**（exit 0）。**3 つ以上**失敗した場合のみジョブが**失敗**（exit 1）となり、通知のノイズを抑えます。

---

## データ追加フロー（手動・その他ソース）

なろう以外や独自生成データを扱う場合。本番の主経路は週次 Actions ですが、**`/kaihatsu`** での検証・投入（デバッグ・緊急時）に加え、次のフローも利用できます。

1. ルートの **[PDF_TO_JSON_PROMPT.md](./PDF_TO_JSON_PROMPT.md)** 等で `RankingDataset` 形式の JSON を用意する（**Claude** 等での生成可）。
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

## 類似検索機能（トップページ「タイトル類似度チェック」）

入力したタイトル案を形態素解析し、現在のランキングコーパス内の作品タイトルと **共通語の IDF 重み付けスコア**で候補を出し、**最大 10 件**を返します。

### 仕組みの概要

- **トークン化**: サーバー側で **kuromoji** により名詞・動詞・形容詞を抽出（`/api/similar` は Node.js ランタイム）。
- **スコア**（API レスポンス）: クエリと各作品タイトルの **積集合**にあるトークンについて、コーパス全体の **IDF**（\( \ln(N/\mathrm{df}) \)）の **和**を `score` とし、上位集合では `normalizedScore`（最大を 100）も付与。**画面上では数値は出さず**、カードには一致語数とタイトル内ハイライトで示します。
- **並び順**（サーバー側）: **希少一致語数**（`rareMatchedTokens` の件数）降順 → **総一致語数**（`matchedTokens`）降順 → ランキング **points** 降順。希少語は **文書頻度 df がコーパス件数 N の 5% 未満**の語とします。
- **結果連携**: 検索後、トークンクラウド上で同じ語にハイライトを付けます。

### 入力制限

- タイトルは **最大 100 文字**（UI の `maxLength` と API 側の `slice` の両方で制御）。
- 空入力では送信されません。

### レート制限

- **IP あたり 60 秒間に 30 リクエスト**まで（`/api/similar`）。超過時は HTTP 429 と `RATE_LIMIT` コードを返します。
- フロントでは連続エラー時にクールダウン表示があります（誤操作・スパム緩和）。

### 本番・コールドスタート（kuromoji 辞書）

初回リクエストで **kuromoji が `node_modules/kuromoji/dict` を読み込み**ます。`npm install` 後に辞書ファイル（`base.dat.gz` 等）が欠けていると `/api/similar` が 500 になります。Vercel の関数ログに `[api/similar] tokenize failed` が出た場合は、ビルド成果物に辞書が含まれているか・パス解決（`serverTokenizer.ts` の `resolveDicPath`）を確認してください。

**フォールバック案**: 形態素解析に失敗し続ける環境では、[tiny-segmenter](https://www.npmjs.com/package/tiny-segmenter) 等で短文を分割し、ストップワード除去のみの簡易トークン列に差し替える実装が現実的です（精度は下がります）。`src/lib/serverTokenizer.ts` の `tokenize()` を try 内で kuromoji、catch でセグメンターに委譲する形がよいです。

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

## 監視

GitHub Actions の実行結果は次から確認できます。

[Weekly Narou Fetch · Actions](https://github.com/tabisurushosai/taitolabo/actions/workflows/weekly-fetch.yml)

失敗時は GitHub に登録したメールアドレスへ通知が届きます（**Settings → Notifications** で調整可能）。
