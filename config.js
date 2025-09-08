// Pellamori QRスキャナー設定
const CONFIG = {
  // Google Apps Script API設定
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbzqvQsMFqlCuPgqtixvngYBovswjApld_UOuEr2iY78jjEZA1WXamOPdbjMV5kqux4O/exec', // ←実際のGAS URLに変更
  
  // チケット検証API設定
  TICKET_API_URL: 'https://script.google.com/macros/s/AKfycbzqvQsMFqlCuPgqtixvngYBovswjApld_UOuEr2iY78jjEZA1WXamOPdbjMV5kqux4O/exec',
  
  // アプリケーション設定
  APP_NAME: 'Pellamori QRスキャナー',
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

// 設定の検証
if (typeof window !== 'undefined') {
  console.log('Pellamori Config loaded:', CONFIG.APP_NAME, 'v' + CONFIG.APP_VERSION);
}