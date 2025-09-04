/**
 * QRスキャナー設定ファイル
 * 
 * 使用方法:
 * 1. Google Cloud ConsoleでGoogle Sheets APIを有効化
 * 2. APIキーを作成（制限: Google Sheets API のみ）
 * 3. 下記のYOUR_GOOGLE_API_KEY_HEREを実際のAPIキーに置き換え
 */

window.QR_SCANNER_CONFIG = {
    // Google Apps Script Web AppのURL（デプロイ後に取得）
    GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxTk2xJTuBrtJ-G_LtoHHDXwvJYf663P23ntGtDOlaLF0ZinbZ0crtP3s8bNv_EkF1kYQ/exec',
    
    // 従来のGoogle Sheets API設定（フォールバック用）
    GOOGLE_SHEETS: {
        API_KEY: 'YOUR_GOOGLE_API_KEY_HERE',
        SPREADSHEET_ID: '1HVGYDKFOIkhM26Hk73X4AeO-X__hQmKXB6eln3vxeDQ',
        SHEET_NAME: 'チケット管理'
    }
};