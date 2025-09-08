# ペラもりQRスキャナー - 環境変数設定

## ⚠️ セキュリティ対応完了
- ハードコードされた機密情報をすべて削除済み
- 環境変数による設定に変更済み

## 🔐 必要な環境変数

### 本番環境で設定が必要な値

```javascript
// window.QR_SCANNER_CONFIG に設定する値
window.QR_SCANNER_CONFIG = {
  // メインAPI (必須)
  GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
  
  // フォールバック用 Google Sheets API (オプション)
  GOOGLE_SHEETS: {
    SPREADSHEET_ID: "YOUR_SPREADSHEET_ID",
    SHEET_NAME: "YOUR_SHEET_NAME", 
    API_KEY: "YOUR_GOOGLE_API_KEY"
  }
};
```

## 🚀 デプロイ時の設定方法

### 1. GitHub Pages + GitHub Secrets
```yaml
# .github/workflows/deploy.yml
env:
  GOOGLE_APPS_SCRIPT_URL: ${{ secrets.GOOGLE_APPS_SCRIPT_URL }}
  SPREADSHEET_ID: ${{ secrets.SPREADSHEET_ID }}
  SHEET_NAME: ${{ secrets.SHEET_NAME }}
  GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

### 2. Vercel環境変数
```bash
vercel env add GOOGLE_APPS_SCRIPT_URL
vercel env add SPREADSHEET_ID  
vercel env add SHEET_NAME
vercel env add GOOGLE_API_KEY
```

### 3. Netlify環境変数
Site settings → Build & deploy → Environment variables

## 🔧 ローカル開発用設定

```javascript
// dev-config.js (ローカル開発用、.gitignoreに追加)
window.QR_SCANNER_CONFIG = {
  GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/[YOUR_DEV_SCRIPT_ID]/exec",
  GOOGLE_SHEETS: {
    SPREADSHEET_ID: "[YOUR_DEV_SPREADSHEET_ID]", 
    SHEET_NAME: "[YOUR_DEV_SHEET_NAME]",
    API_KEY: "[YOUR_DEV_API_KEY]"
  }
};
```

## 📋 設定値の取得方法

### Google Apps Script URL
1. Google Apps Script → デプロイ → ウェブアプリとしてデプロイ
2. 生成されたURLをコピー

### スプレッドシート ID
1. Google Sheets URLから取得
2. `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

### Google Sheets API Key
1. Google Cloud Console → APIs & Services → Credentials
2. APIキーを作成
3. Google Sheets APIを有効化

## ⚡ 現在の設定状況

✅ **安全**: ハードコード値削除済み  
✅ **動作**: Google Apps Script URLは稼働中  
⚠️ **要設定**: 本番デプロイ時に環境変数設定必要