// ペラもりQRスキャナー設定
const CONFIG = {
  // Google Apps Script統合API設定（全機能対応）
  API_ENDPOINT: 'https://script.google.com/macros/s/AKfycbzqvQsMFqlCuPgqtixvngYBovswjApld_UOuEr2iY78jjEZA1WXamOPdbjMV5kqux4O/exec',
  
  // アプリケーション設定
  APP_NAME: 'ペラもりQRスキャナー',
  APP_VERSION: '1.0.0',
  
  // QRスキャナー設定
  SCANNER_CONFIG: {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0
  },
  
  // UI設定
  THEME: {
    primary: '#e91e63',
    secondary: '#2196f3',
    success: '#4caf50',
    error: '#f44336',
    warning: '#ff9800'
  },
  
  // デバッグ設定
  DEBUG: false,
  
  // キャッシュ設定
  CACHE_ENABLED: true,
  CACHE_DURATION: 300000 // 5分
};

// アプリケーション用グローバル設定
if (typeof window !== 'undefined') {
  // QRスキャナー用の設定を統合
  window.QR_SCANNER_CONFIG = {
    GOOGLE_APPS_SCRIPT_URL: CONFIG.API_ENDPOINT
  };
}