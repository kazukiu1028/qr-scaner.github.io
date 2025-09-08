# Google Apps Script セットアップガイド

## 🔒 セキュリティ改善完了
- スプレッドシートIDのハードコード削除
- スクリプトプロパティによる安全な管理に変更
- フロントエンドからは完全に分離

## 📋 初期設定手順

### 1. Google Apps Scriptプロジェクトを開く
1. [Google Apps Script](https://script.google.com) にアクセス
2. 既存のプロジェクトを開くか、新規作成

### 2. コードをデプロイ
1. `ticket-api.js` の内容をコピー
2. Google Apps Scriptエディタに貼り付け
3. 保存（Ctrl+S / Cmd+S）

### 3. スクリプトプロパティを設定 ⚠️重要
1. **プロジェクトの設定**（歯車アイコン）をクリック
2. **スクリプトプロパティ**セクションまでスクロール
3. **プロパティを追加**をクリック
4. 以下のプロパティを設定：

| プロパティ名 | 値 | 説明 |
|-------------|-----|------|
| `SPREADSHEET_ID` | `1HVGYDKFOIkhM26H...` | スプレッドシートのID |
| `SHEET_NAME` | `チケット管理` | データが入っているシート名 |

### 4. デプロイ
1. **デプロイ** → **新しいデプロイ**
2. 種類: **ウェブアプリ**
3. 設定:
   - 実行者: **自分**
   - アクセス権限: **全員**
4. **デプロイ**をクリック
5. 生成されたURLをコピー

### 5. フロントエンドに設定
`config.js` のAPI_ENDPOINTに、上記でコピーしたURLを設定：
```javascript
API_ENDPOINT: 'https://script.google.com/macros/s/[YOUR_SCRIPT_ID]/exec'
```

## 🔐 なぜスクリプトプロパティ？

**メリット:**
- ✅ コードにハードコードしない
- ✅ GitHubに露出しない
- ✅ 環境ごとに異なる値を設定可能
- ✅ Google Apps Script内で安全に管理

**セキュリティ:**
- スクリプトプロパティはプロジェクト内でのみアクセス可能
- 外部からは参照不可
- デプロイ権限がある人のみ変更可能

## 📊 スプレッドシートIDの確認方法

Google SheetsのURLから取得：
```
https://docs.google.com/spreadsheets/d/[ここがSPREADSHEET_ID]/edit
```

例:
```
https://docs.google.com/spreadsheets/d/1HVGYDKFOIkhM26Hk73X4AeO-X__hQmKXB6eln3vxeDQ/edit
                                      ↑ この部分をコピー
```

## 🚨 トラブルシューティング

### エラー: "SPREADSHEET_IDがスクリプトプロパティに設定されていません"
→ スクリプトプロパティの設定を確認

### エラー: "シートが見つかりません"
→ SHEET_NAMEが正しいか確認（タブ名と一致させる）

### エラー: "権限がありません"
→ スプレッドシートの共有設定を確認

## ✅ 設定確認方法

ブラウザで以下にアクセス：
```
[デプロイURL]?action=test
```

正常な応答例：
```json
{
  "success": true,
  "message": "チケット管理API正常動作中",
  "spreadsheet_id": "1HVG...",
  "sheet_name": "チケット管理"
}
```