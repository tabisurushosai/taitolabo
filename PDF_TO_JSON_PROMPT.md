# PDF→JSON 変換プロンプト

なろう or カクヨムのランキングPDFを Claude Opus に投げるときに、以下のプロンプトを添えてください。
出力されたJSONをそのままサイトの /kaihatsu に貼り付けて使えます（パスワードが必要です）。

---

添付のPDFは「なろう日間総合ランキング」/「カクヨム週間総合ランキング」などのスクリーンショットPDFです。
以下のスキーマで、上位のエントリを JSON に変換してください。

スキーマ：
{
  "source": "narou_daily_total" | "narou_daily_isekai_ren" | "narou_daily_humandrama" | "kakuyomu_weekly_total" | "kakuyomu_weekly_romcom",
  "date": "YYYY-MM-DD",   // PDF右上の日付
  "entries": [
    {
      "rank": number,
      "title": "元のタイトルそのまま",
      "titleTokens": ["タイトルから抽出した名詞・固有名詞・特徴語（重複排除、2文字以上）"],
      "author": "作者名",
      "points": number,   // ptや★の数値
      "genre": "ジャンル表記そのまま（例: 異世界〔恋愛〕）",
      "tags": ["タグ1", "タグ2", ...],  // PDFに見えるタグをそのまま列挙
      "synopsisHead": "あらすじ冒頭をそのまま150文字程度",
      "synopsisTokens": ["あらすじから抽出した重要語（名詞中心、2文字以上、6-10個程度）"],
      "isShort": true/false  // 短編フラグ（PDFに「短編」表記あれば true）
    }
  ]
}

トークン抽出のコツ：
- 一般語（私、彼、彼女、ある、日、ない、等）は除く
- 作品固有の設定語・役柄語・シチュエーション語を優先
- 「婚約破棄」「令嬢」「勇者」「転生」「チート」「ざまぁ」等の定番語は必ず含める
- 複合語は分割せずそのまま1トークンとして扱う（例：「婚約破棄」は1つ、「婚約」＋「破棄」ではない）

注意：
- PDFに20件分表示されていれば、すべて出力してください
- JSON以外の説明文は含めず、JSONのみを出力

---
