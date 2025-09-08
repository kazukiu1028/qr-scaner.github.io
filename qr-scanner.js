/**
 * QRスキャナー アプリケーション（スタンドアロン版）
 * モジュール化されたJavaScript
 */

(function() {
    'use strict';

    // 設定
    const CONFIG = {
        VIDEO: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment'
        },
        SCAN_OPTIONS: {
            inversionAttempts: "dontInvert"
        },
        AUDIO: {
            SUCCESS: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzCMz+8=',
            VOLUME: 0.3
        },
        SHEETS: {
            // Google Apps Script Web App URL
            get GAS_URL() {
                return window.QR_SCANNER_CONFIG?.GOOGLE_APPS_SCRIPT_URL || '';
            },
            // Google Sheets API設定（環境変数から取得）
            get SPREADSHEET_ID() {
                return window.QR_SCANNER_CONFIG?.GOOGLE_SHEETS?.SPREADSHEET_ID || null;
            },
            get SHEET_NAME() {
                return window.QR_SCANNER_CONFIG?.GOOGLE_SHEETS?.SHEET_NAME || null;
            },
            get API_KEY() {
                return window.QR_SCANNER_CONFIG?.GOOGLE_SHEETS?.API_KEY || null;
            }
        }
    };


    // Google Sheets API関連の関数
    class SheetsAPI {
        static async getConfig() {
            
            // Google Apps Scriptから設定を取得
            if (window.QR_SCANNER_CONFIG && window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL && 
                window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
                try {
                    const url = `${window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL}?action=get_config`;
                    
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
                    }
                    
                    const responseText = await response.text();
                    
                    let data;
                    try {
                        data = JSON.parse(responseText);
                    } catch (parseError) {
                        throw new Error(`JSON解析エラー: ${parseError.message}`);
                    }
                    
                    
                    if (data.success && data.config) {
                        return {
                            success: true,
                            config: {
                                pin: data.config.pin || '1234',
                                max_attempts: data.config.max_attempts || 3
                            }
                        };
                    } else {
                        return {
                            success: false,
                            config: {
                                pin: '1234',
                                max_attempts: 3
                            }
                        };
                    }
                } catch (error) {
                    return {
                        success: false,
                        config: {
                            pin: '1234',
                            max_attempts: 3
                        }
                    };
                }
            }
            
            // Google Apps Script URLが設定されていない場合
            return {
                success: false,
                config: {
                    pin: '1234',
                    max_attempts: 3
                }
            };
        }
        
        static async getTicketData(ticketNumber) {
            // 1. Google Apps Scriptを優先的に使用
            if (window.QR_SCANNER_CONFIG && window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL && window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
                try {
                    // API呼び出し中
                    const response = await fetch(`${CONFIG.SHEETS.GAS_URL}?ticket_number=${encodeURIComponent(ticketNumber)}`);
                    const result = await response.json();
                    
                    if (result.success && result.data) {
                        // データ取得成功
                        return result.data;
                    } else {
                        return null;
                    }
                } catch (error) {
                    // フォールバックで直接APIを試行
                }
            }
            
            // 2. Google Sheets API（フォールバック）
            try {
                if (!CONFIG.SHEETS.API_KEY || CONFIG.SHEETS.API_KEY === 'YOUR_GOOGLE_API_KEY_HERE') {
                    return null;
                }
                
                // Sheets API使用
                const range = `${CONFIG.SHEETS.SHEET_NAME}!A:M`;
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEETS.SPREADSHEET_ID}/values/${range}?key=${CONFIG.SHEETS.API_KEY}`;
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Google Sheets API error: ${response.status}`);
                }
                
                const data = await response.json();
                const rows = data.values || [];
                
                if (rows.length === 0) {
                    return null;
                }
                
                // ヘッダー行を取得
                const headers = rows[0];
                
                // チケット番号で検索
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const ticketNumberIndex = headers.indexOf('チケット番号');
                    
                    if (ticketNumberIndex !== -1 && row[ticketNumberIndex] === ticketNumber) {
                        return this.parseRowData(headers, row);
                    }
                }
                
                return null;
            } catch (error) {
                console.error('All Google APIs failed:', error);
                throw error;
            }
        }
        
        static parseRowData(headers, row) {
            const data = {};
            
            // ヘッダーとデータをマッピング
            headers.forEach((header, index) => {
                data[header] = row[index] || '';
            });
            
            
            // フォーマットして返却
            return {
                name: data['顧客名'] || '',
                email: data['メールアドレス'] || '',
                phone: data['電話番号'] || '',
                event: data['イベント名'] || '',
                ticketType: data['チケット種別'] || '',
                ticketNumber: data['チケット番号'] || '',
                mainTicketNumber: data['メインチケット番号'] || '',
                amount: this.parseAmount(data['1枚価格']),
                purchaseDate: data['購入日時'] || '',
                paymentStatus: data['支払い状況'] || data['支払い完了'] || '',
                entryStatus: data['入場状況'] || '未入場',
                sessionId: data['session_id'] || ''
            };
        }
        
        static parseAmount(amountStr) {
            if (!amountStr) return 0;
            // 数字以外を除去して数値に変換
            const numStr = amountStr.toString().replace(/[^\d]/g, '');
            return parseInt(numStr) || 0;
        }
        
        static async updateEntryStatus(ticketNumber, status = '入場済み') {
            // 1. Google Apps Scriptを優先的に使用（JSONPでCORSを回避）
            if (window.QR_SCANNER_CONFIG && window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL && window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
                try {
                    // 入場状況更新中
                    
                    // フォールバック: シンプルなGETリクエスト（no-cors モード）
                    const url = `${window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL}?ticket_number=${encodeURIComponent(ticketNumber)}&status=${encodeURIComponent(status)}&action=update&t=${Date.now()}`;
                    
                    await fetch(url, {
                        method: 'GET',
                        mode: 'no-cors'
                    });
                    
                    // no-corsモードでは response.json() が使えないが、リクエストは確実に送信される
                    return true;
                } catch (error) {
                    return false;
                }
            }
            
            // 2. フォールバック（ログ出力のみ）
            // API未設定のため更新スキップ
            return true; // UIの動作を継続するためtrueを返す
        }
        
        static async searchTicketByPartial(partialNumber) {
            // Google Apps Scriptで部分検索
            if (window.QR_SCANNER_CONFIG && window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL && window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
                const url = `${window.QR_SCANNER_CONFIG.GOOGLE_APPS_SCRIPT_URL}?action=partial_search&partial=${encodeURIComponent(partialNumber)}&t=${Date.now()}`;
                
                try {
                    
                    // CORSモードで試行（結果を取得するため）
                    const response = await fetch(url, {
                        method: 'GET',
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result.success && result.data) {
                            return result.data;
                        }
                    }
                    
                } catch (error) {
                    // CORSが失敗した場合、no-corsモードで送信だけする
                    try {
                        await fetch(url, {
                            method: 'GET',
                            mode: 'no-cors'
                        });
                    } catch (noCorsError) {
                        // Silently fail
                    }
                }
            }
            
            return null;
        }
    }

    // QRスキャナークラス
    class QRScanner {
        constructor() {
            this.elements = this.initElements();
            this.state = this.initState();
            this.init();
        }

        initElements() {
            return {
                video: document.getElementById('video'),
                canvas: document.getElementById('canvas'),
                context: document.getElementById('canvas').getContext('2d'),
                cameraSelect: document.getElementById('cameraSelect'),
                statusElement: document.getElementById('status'),
                resultContainer: document.getElementById('resultContainer'),
                qrContent: document.getElementById('qrContent'),
                errorMessage: document.getElementById('errorMessage'),
                ticketInfo: document.getElementById('ticketInfo'),
                ticketDetails: document.getElementById('ticketDetails'),
                verifyBtn: document.getElementById('verifyBtn'),
                resetBtn: document.getElementById('resetBtn'),
                shutterBtn: document.getElementById('shutterBtn'),
                closeBtn: document.getElementById('closeBtn'),
                cameraOffBtn: document.getElementById('cameraOffBtn'),
                testBtn: document.getElementById('testBtn'),
                scannerLine: document.getElementById('scannerLine'),
                scannerOverlay: document.querySelector('.scanner-overlay'),
                headerMessage: document.getElementById('headerMessage'),
                cameraPlaceholder: document.getElementById('cameraPlaceholder'),
                retryCamera: document.getElementById('retryCameraBtn')
            };
        }

        initState() {
            return {
                currentStream: null,
                scanning: false,
                lastScannedCode: null,
                animationFrameId: null,
                isScanning: false
            };
        }

        init() {
            // カメラボタンの初期状態を設定（カメラはオン状態から開始）
            if (this.elements.cameraOffBtn) {
                this.elements.cameraOffBtn.classList.add('camera-on');
                this.elements.cameraOffBtn.title = 'カメラをオフ';
            }
            
            this.bindEvents();
            // カメラは認証後にinitCamera()で起動される
        }

        bindEvents() {
            // シャッターボタン
            if (this.elements.shutterBtn) {
                this.elements.shutterBtn.addEventListener('click', () => {
                    this.toggleScanning();
                });
            }

            // 閉じるボタン
            if (this.elements.closeBtn) {
                this.elements.closeBtn.addEventListener('click', () => {
                    this.closeCamera();
                });
            }
            // カメラオフボタン
            if (this.elements.cameraOffBtn) {
                this.elements.cameraOffBtn.addEventListener('click', () => {
                    this.toggleCamera();
                });
            }

            // テストボタン
            if (this.elements.testBtn) {
                this.elements.testBtn.addEventListener('click', () => {
                    document.getElementById('manualInput').style.display = 'block';
                });
            }

            // カメラ選択変更
            if (this.elements.cameraSelect) {
                this.elements.cameraSelect.addEventListener('change', (e) => {
                    if (e.target.value) {
                        this.startCamera(e.target.value);
                    }
                });
            }

            // 確認ボタン（スタンドアロンでは簡易表示）
            if (this.elements.verifyBtn) {
                this.elements.verifyBtn.addEventListener('click', () => {
                    this.showVerificationResult();
                });
            }

            // リセットボタン（キャンセル）
            if (this.elements.resetBtn) {
                this.elements.resetBtn.addEventListener('click', () => {
                    this.resetScanner();
                });
            }

            // 再試行ボタン（存在する場合のみ）
            if (this.elements.retryCamera) {
                this.elements.retryCamera.addEventListener('click', () => {
                    this.retryCamera();
                });
            }

            // ページ離脱時の処理
            window.addEventListener('beforeunload', () => {
                this.cleanup();
            });
        }

        async initCamera() {
            try {
                this.updateHeaderMessage('カメラを初期化中...');
                
                // 許可状態をチェック
                await this.checkCameraPermissions();
                
                const devices = await this.getVideoDevices();
                this.updateCameraList(devices);
                
                const defaultDevice = this.selectDefaultDevice(devices);
                if (defaultDevice) {
                    await this.startCamera(defaultDevice.deviceId);
                } else {
                    throw new Error('利用可能なカメラデバイスが見つかりません');
                }
            } catch (error) {
                console.error('カメラ初期化エラー:', error);
                this.handleCameraError('カメラへのアクセスが拒否されました', error);
            }
        }

        async checkCameraPermissions() {
            try {
                const permissions = await navigator.permissions.query({name: 'camera'});
                
                // HTTPS確認
                if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                    throw new Error('カメラ機能にはHTTPS接続が必要です');
                }
                
                return permissions.state;
            } catch (error) {
                // 権限チェックに失敗しても続行
            }
        }

        async getVideoDevices() {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        }

        updateCameraList(devices) {
            const select = this.elements.cameraSelect;
            select.innerHTML = '<option value="">カメラを選択...</option>';
            
            devices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `カメラ ${index + 1}`;
                
                // 背面カメラを優先
                if (this.isBackCamera(device)) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }

        isBackCamera(device) {
            return device.label && device.label.toLowerCase().includes('back');
        }

        selectDefaultDevice(devices) {
            return devices.find(d => this.isBackCamera(d)) || devices[0];
        }

        async startCamera(deviceId) {
            try {
                this.updateHeaderMessage('カメラを起動中...');
                
                this.stopCurrentStream();
                
                const constraints = this.buildConstraints(deviceId);
                
                this.state.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
                
                this.elements.video.srcObject = this.state.currentStream;
                
                await this.elements.video.play();
                
                this.elements.video.addEventListener('loadedmetadata', () => {
                    this.setupCanvas();
                }, { once: true });
                
                this.hideError();
                this.hideCameraPlaceholder();
                this.updateHeaderMessage('QRコードをスキャン');
                this.updateStatus('ready', 'シャッターボタンを押してスキャン');
            } catch (error) {
                console.error('カメラ起動エラー:', error);
                this.handleCameraError('カメラの起動に失敗しました', error);
            }
        }

        buildConstraints(deviceId) {
            return {
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    ...CONFIG.VIDEO,
                    facingMode: deviceId ? undefined : CONFIG.VIDEO.facingMode
                }
            };
        }

        stopCurrentStream() {
            if (this.state.currentStream) {
                this.state.currentStream.getTracks().forEach(track => track.stop());
                this.state.currentStream = null;
            }
        }

        setupCanvas() {
            this.elements.canvas.width = this.elements.video.videoWidth;
            this.elements.canvas.height = this.elements.video.videoHeight;
        }

        startScanning() {
            if (this.state.isScanning) {
                this.scanQRCode();
            }
        }

        toggleScanning() {
            if (this.state.isScanning) {
                this.stopScanning();
            } else {
                this.startSingleScan();
            }
        }

        startSingleScan() {
            this.state.isScanning = true;
            this.state.scanning = true;
            this.elements.shutterBtn.classList.add('scanning');
            this.elements.scannerLine.classList.add('active');
            this.updateStatus('scanning', 'スキャン中...');
            this.scanQRCode();
        }

        stopScanning() {
            this.state.isScanning = false;
            this.state.scanning = false;
            this.elements.shutterBtn.classList.remove('scanning');
            this.elements.scannerLine.classList.remove('active');
            if (this.state.animationFrameId) {
                cancelAnimationFrame(this.state.animationFrameId);
            }
            this.updateStatus('ready', 'シャッターボタンを押してスキャン');
        }

        closeCamera() {
            // カメラを停止
            this.stopScanning();
            this.cleanup();
            
            // メインアプリを非表示
            document.getElementById('mainApp').style.display = 'none';
            
            // 認証画面を表示
            document.getElementById('authScreen').classList.remove('hidden');
            
            // 認証マネージャーのPINをクリア
            if (window.authManager) {
                window.authManager.clearPin();
            }
            
        }
        
        toggleCamera() {
            
            if (this.state.currentStream) {
                // カメラがオンの場合はオフにする
                this.stopCurrentStream();
                this.elements.cameraOffBtn.classList.remove('camera-on');
                this.elements.cameraOffBtn.title = 'カメラをオン';
                this.updateHeaderMessage('カメラがオフです');
                this.updateStatus('ready', 'カメラオンボタンを押してカメラを起動');
                
                // ビデオとスキャナーオーバーレイを非表示にしてプレースホルダーを表示
                this.elements.video.style.display = 'none';
                if (this.elements.scannerOverlay) {
                    this.elements.scannerOverlay.style.display = 'none';
                }
                this.showCameraPlaceholder();
                
            } else {
                // カメラをオンにする
                this.elements.cameraOffBtn.classList.add('camera-on');
                this.elements.cameraOffBtn.title = 'カメラをオフ';
                this.hideCameraPlaceholder();
                this.elements.video.style.display = 'block';
                if (this.elements.scannerOverlay) {
                    this.elements.scannerOverlay.style.display = 'block';
                }
                this.initCamera();
            }
        }

        scanQRCode() {
            if (!this.state.scanning) return;
            
            if (this.elements.video.readyState === this.elements.video.HAVE_ENOUGH_DATA) {
                this.processFrame();
            }
            
            this.state.animationFrameId = requestAnimationFrame(() => this.scanQRCode());
        }

        processFrame() {
            const { canvas, context, video } = this.elements;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, CONFIG.SCAN_OPTIONS);
            
            if (code && code.data !== this.state.lastScannedCode) {
                this.handleQRCode(code.data);
            }
        }

        handleQRCode(data) {
            this.stopScanning();
            this.state.lastScannedCode = data;
            
            this.playSuccessSound();
            this.updateStatus('success', 'QRコードを検出しました！');
            this.displayResult(data);
            this.parseTicketData(data);
        }

        playSuccessSound() {
            const audio = new Audio(CONFIG.AUDIO.SUCCESS);
            audio.volume = CONFIG.AUDIO.VOLUME;
            audio.play().catch(() => {});
        }

        displayResult(data) {
            this.elements.qrContent.textContent = data;
            this.elements.resultContainer.classList.add('show');
            this.elements.resultContainer.removeAttribute('aria-hidden');
            this.elements.resultContainer.removeAttribute('inert');
        }

        parseTicketData(data) {
            try {
                // チケット番号を直接検索
                if (this.isTicketNumber(data)) {
                    this.displayTicketInfo(data);
                }
                // Session IDを抽出
                else if (this.extractSessionId(data)) {
                    const sessionId = this.extractSessionId(data);
                    this.displayCustomerInfo(sessionId);
                } else if (this.isJsonData(data)) {
                    this.displayJsonInfo(data);
                } else if (this.isUrl(data)) {
                    this.displayUrlInfo(data);
                } else {
                    // 直接session_idの場合
                    if (data.startsWith('cs_test_') || data.startsWith('cs_')) {
                        this.displayCustomerInfo(data);
                    } else {
                        // 不明なデータの場合、チケット番号として検索を試行
                        this.displayTicketInfo(data);
                    }
                }
            } catch (error) {
            }
        }
        
        isTicketNumber(data) {
            // チケット番号のパターンを判定（例：TKT-20240901-001）
            return /^TKT-\d{8}-\d{3}$/.test(data) || data.includes('TKT-');
        }

        extractSessionId(data) {
            // URLからsession_idを抽出
            if (data.includes('session_id=')) {
                const url = new URL(data);
                return url.searchParams.get('session_id');
            }
            // 直接session_idの場合
            if (data.startsWith('cs_')) {
                return data;
            }
            return null;
        }

        async displayTicketInfo(ticketNumber) {
            try {
                this.updateStatus('scanning', 'チケット情報を取得中...');
                
                // 1. まずキャッシュから高速検索
                if (window.dataSyncManager) {
                        const startTime = performance.now();
                    const cachedData = window.dataSyncManager.searchInCache(ticketNumber);
                    const cacheTime = performance.now() - startTime;
                    
                    if (cachedData) {
                        this.showTicketDetails(cachedData);
                        this.updateStatus('success', '✅ チケットが確認されました（キャッシュ）');
                        return;
                    } else {
                    }
                }
                
                // 2. キャッシュにない場合はAPI検索
                const apiStartTime = performance.now();
                const ticketData = await SheetsAPI.getTicketData(ticketNumber);
                const apiTime = performance.now() - apiStartTime;
                
                if (ticketData) {
                    this.showTicketDetails(ticketData);
                    this.updateStatus('success', '✅ チケットが確認されました（API）');
                } else {
                    this.showTicketInfoError(ticketNumber, 'チケットが見つかりません');
                }
            } catch (error) {
                console.error('チケット情報取得エラー:', error);
                this.showTicketInfoError(ticketNumber, error.message);
            }
        }
        
        async displayCustomerInfo(sessionId) {
            // 直接session_idでチケット検索を行う
            this.showTicketInfoError(sessionId, 'チケットが見つかりません');
        }
        
        showTicketInfoError(identifier, errorMessage) {
            this.showTicketInfo(`
                <div style="color: #f44336;">
                    <strong>❌ チケットが見つかりません</strong><br>
                    <small>ID: ${this.escapeHtml(identifier)}</small><br>
                    <small>エラー: ${this.escapeHtml(errorMessage)}</small>
                </div>
            `);
            this.updateStatus('error', 'チケットが見つかりません');
        }

        showTicketDetails(data) {
            // 現在のチケットデータを保存（ボタンクリック時に使用）
            this.currentTicketData = data;
            
            
            // 複数のパターンに対応（Stripeの paid/unpaid も含む）
            const isPaid = data.paymentStatus === '支払い完了' || 
                          data.paymentStatus === 'paid' || 
                          data.paymentStatus === '支払済' ||
                          data.paymentStatus === '支払い済み' ||
                          data.paymentStatus === 'complete';
            
            const isEntered = data.entryStatus === '入場済み' || 
                             data.entryStatus === 'entered' ||
                             data.entryStatus === '入場済' ||
                             data.entryStatus === '使用済み';
            
            // ステータス用のバッジスタイル（白背景に緑ボーダー）
            const paymentBadgeStyle = isPaid ? 'background: white; color: #4CAF50; border: 1px solid #4CAF50;' : 'background: white; color: #ef4444; border: 1px solid #ef4444;';
            const paymentBadgeText = isPaid ? '支払済' : '未払い';
            const paymentIcon = isPaid ? '✓' : '✕';
            
            // 入場ステータス（未払いの場合は入場不可）
            let entryBadgeStyle, entryBadgeText, entryIcon;
            if (!isPaid) {
                // 未払いの場合は入場不可
                entryBadgeStyle = 'background: white; color: #ef4444; border: 1px solid #ef4444;';
                entryBadgeText = '入場不可';
                entryIcon = '✕';
            } else if (isEntered) {
                // 支払い済み＋入場済み
                entryBadgeStyle = 'background: white; color: #f59e0b; border: 1px solid #f59e0b;';
                entryBadgeText = '入場済';
                entryIcon = '🚫';
            } else {
                // 支払い済み＋未入場
                entryBadgeStyle = 'background: white; color: #4CAF50; border: 1px solid #4CAF50;';
                entryBadgeText = '入場可能';
                entryIcon = '✓';
            }
            
            // ボタン状態の設定
            if (!isPaid && this.elements.verifyBtn) {
                // 未払いの場合
                this.elements.verifyBtn.innerHTML = '⚠️ 支払い未完了';
                this.elements.verifyBtn.className = 'btn';
                this.elements.verifyBtn.style.background = '#ef4444';
                this.elements.verifyBtn.style.color = 'white';
                this.elements.verifyBtn.style.border = 'none';
                this.elements.verifyBtn.disabled = true;
                this.updateStatus('error', '⚠️ 支払いが完了していないため入場できません');
            } else if (isEntered && this.elements.verifyBtn) {
                // 既に入場済みの場合
                this.elements.verifyBtn.innerHTML = '✓ 使用済み';
                this.elements.verifyBtn.className = 'btn';
                this.elements.verifyBtn.style.background = '#6c757d';
                this.elements.verifyBtn.style.color = 'white';
                this.elements.verifyBtn.style.border = 'none';
                this.elements.verifyBtn.disabled = true;
                this.updateStatus('error', '⚠️ このチケットは既に使用済みです');
            } else if (this.elements.verifyBtn) {
                // 支払い済み＋未入場の場合は通常の状態
                this.elements.verifyBtn.innerHTML = '使用済みにする';
                this.elements.verifyBtn.className = 'btn btn-success';
                this.elements.verifyBtn.style.background = '';
                this.elements.verifyBtn.style.color = '';
                this.elements.verifyBtn.style.border = '';
                this.elements.verifyBtn.disabled = false;
            }
            
            this.showTicketInfo(`
                <div style="background: #f8f9fa; padding: 15px 0; border-radius: 10px; margin-bottom: 10px;">
                    <!-- 名前とステータスバッジ -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <strong style="font-size: 18px; color: #333;">${this.escapeHtml(data.name)}</strong>
                        <div style="display: flex; gap: 8px;">
                            <span style="${paymentBadgeStyle} padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                                <span style="font-size: 10px;">${paymentIcon}</span>
                                ${paymentBadgeText}
                            </span>
                            <span style="${entryBadgeStyle} padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                                <span style="font-size: 10px;">${entryIcon}</span>
                                ${entryBadgeText}
                            </span>
                        </div>
                    </div>
                    
                    <!-- チケット番号と購入日時 -->
                    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
                        <div style="margin-bottom: 8px;">
                            <div style="font-size: 11px; color: #999; margin-bottom: 2px;">チケット番号</div>
                            <div style="font-size: 16px; font-weight: 600; color: #333; font-family: monospace;">
                                ${this.escapeHtml(data.ticketNumber)}
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #999; margin-bottom: 2px;">購入日時</div>
                            <div style="font-size: 14px; color: #666;">
                                ${this.formatDate(data.purchaseDate)}
                            </div>
                        </div>
                    </div>
                    
                    
                    <!-- イベント情報と席種 -->
                    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
                        <div style="margin-bottom: 8px;">
                            <div style="font-size: 11px; color: #999; margin-bottom: 2px;">イベント</div>
                            <div style="font-size: 16px; font-weight: 600; color: #333;">
                                ${this.escapeHtml(data.event)}
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #999; margin-bottom: 2px;">チケット</div>
                            <div style="font-size: 14px; color: #666;">
                                ${this.escapeHtml(data.ticketType)}
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }
        
        formatDate(dateString) {
            if (!dateString) return '不明';
            try {
                const date = new Date(dateString);
                return date.toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch {
                return dateString;
            }
        }

        showCustomerDetails(data) {
            const statusColor = data.status === 'paid' ? '#4CAF50' : '#f44336';
            const statusText = data.status === 'paid' ? '✅ 支払い済み' : '❌ 未払い';
            
            this.showTicketInfo(`
                <div style="background: #f8f9fa; padding: 15px 0; border-radius: 10px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 18px; color: #333;">${this.escapeHtml(data.name)}</strong>
                        <span style="color: ${statusColor}; font-weight: bold; font-size: 14px;">${statusText}</span>
                    </div>
                    
                    
                    <!-- イベント情報と席種 -->
                    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
                        <div style="margin-bottom: 8px;">
                            <div style="font-size: 11px; color: #999; margin-bottom: 2px;">イベント</div>
                            <div style="font-size: 16px; font-weight: 600; color: #333;">
                                ${this.escapeHtml(data.event)}
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #999; margin-bottom: 2px;">チケット</div>
                            <div style="font-size: 14px; color: #666;">
                                ${this.escapeHtml(data.ticketType)}
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 11px; color: #999; margin-bottom: 2px;">購入日時</div>
                        <div style="font-size: 14px; color: #666;">
                            ${data.purchaseDate}
                        </div>
                    </div>
                </div>
            `);
        }

        isSessionUrl(data) {
            return data.includes('session_id=');
        }

        isJsonData(data) {
            return data.startsWith('{');
        }

        isUrl(data) {
            try {
                new URL(data);
                return true;
            } catch {
                return false;
            }
        }

        displaySessionInfo(data) {
            const url = new URL(data);
            const sessionId = url.searchParams.get('session_id');
            
            if (sessionId) {
                this.showTicketInfo(`
                    <strong>Session ID:</strong> ${this.escapeHtml(sessionId)}<br>
                    <small>Stripe Checkoutセッション</small>
                `);
            }
        }

        displayJsonInfo(data) {
            const ticketData = JSON.parse(data);
            this.showTicketInfo(`
                <strong>イベント:</strong> ${this.escapeHtml(ticketData.event || '不明')}<br>
                <strong>購入者:</strong> ${this.escapeHtml(ticketData.name || '不明')}<br>
                <strong>枚数:</strong> ${this.escapeHtml(ticketData.quantity || '不明')}
            `);
        }

        displayUrlInfo(data) {
            this.showTicketInfo(`
                <strong>URL:</strong> <a href="${this.escapeHtml(data)}" target="_blank" style="color: #1976d2;">${this.escapeHtml(data)}</a>
            `);
        }

        showTicketInfo(html) {
            this.elements.ticketInfo.style.display = 'block';
            this.elements.ticketDetails.innerHTML = html;
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        async showVerificationResult() {
            const btn = this.elements.verifyBtn;
            
            // 現在表示されているチケット番号を取得
            const ticketNumber = this.getCurrentTicketNumber();
            
            if (!ticketNumber) {
                this.updateStatus('error', 'チケット番号が見つかりません');
                return;
            }
            
            // ローディング表示
            btn.disabled = true;
            btn.innerHTML = '確認中... <span class="loading-spinner"></span>';
            
            try {
                
                // Google Sheets APIで入場状況を更新
                await SheetsAPI.updateEntryStatus(ticketNumber, '入場済');
                
                // ローカルキャッシュも更新
                if (window.dataSyncManager && window.dataSyncManager.ticketCache) {
                    const cacheIndex = window.dataSyncManager.ticketCache.findIndex(
                        t => t.ticketNumber === ticketNumber
                    );
                    
                    if (cacheIndex !== -1) {
                        window.dataSyncManager.ticketCache[cacheIndex].entryStatus = '入場済';
                        // LocalStorageも更新して永続化
                        localStorage.setItem('venue_tickets', JSON.stringify(window.dataSyncManager.ticketCache));
                    }
                }
                
                this.updateStatus('success', '✅ 入場が承認されました');
                
                // ボタンを使用済みに変更
                btn.innerHTML = '✓ 使用済み';
                btn.className = 'btn';
                btn.style.background = '#6c757d';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.disabled = true;
                
                // 成功音を再生
                this.playSuccessSound();
                
                // チケット詳細の入場状況を更新
                this.updateDisplayedEntryStatus('入場済み');
                
                // キャンセルボタンの文言を「閉じる」に変更
                if (this.elements.resetBtn) {
                    this.elements.resetBtn.textContent = '閉じる';
                }
                
            } catch (error) {
                console.error('入場状況更新エラー:', error);
                this.updateStatus('error', '入場状況の更新に失敗しました');
                btn.disabled = false;
                btn.innerHTML = '読み込み中';
            }
        }
        
        getCurrentTicketNumber() {
            // 現在表示中のチケット情報からチケット番号を取得
            return this.currentTicketData ? this.currentTicketData.ticketNumber : null;
        }
        
        addVerificationBadge() {
            const ticketInfo = this.elements.ticketDetails;
            if (ticketInfo && !ticketInfo.querySelector('.verified-badge')) {
                const verifiedBadge = document.createElement('div');
                verifiedBadge.className = 'verified-badge';
                verifiedBadge.innerHTML = `
                    <div style="
                        background: #4CAF50;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 600;
                        text-align: center;
                        margin-top: 15px;
                        animation: fadeIn 0.3s ease;
                    ">
                        ✅ 入場確認済み<br>
                        <small style="opacity: 0.9;">${new Date().toLocaleString('ja-JP')}</small>
                    </div>
                `;
                ticketInfo.appendChild(verifiedBadge);
            }
        }
        
        updateDisplayedEntryStatus(newStatus) {
            // 表示されている入場状況を更新
            const ticketInfo = this.elements.ticketDetails;
            if (ticketInfo) {
                const entryStatusElements = ticketInfo.querySelectorAll('div');
                entryStatusElements.forEach(element => {
                    if (element.textContent.includes('入場状況') || 
                        element.textContent.includes('入場可能') || 
                        element.textContent.includes('入場済み')) {
                        const parentElement = element.parentElement;
                        if (parentElement) {
                            const statusColor = newStatus === '入場済み' ? '#FF9800' : '#4CAF50';
                            const statusText = newStatus === '入場済み' ? '🚫 入場済み' : '✅ 入場可能';
                            element.style.color = statusColor;
                            element.textContent = newStatus;
                            
                            // 右上のステータス表示も更新
                            const rightStatusDiv = parentElement.querySelector('div[style*="text-align: right"]');
                            if (rightStatusDiv) {
                                const statusDisplays = rightStatusDiv.querySelectorAll('div');
                                statusDisplays.forEach(statusDiv => {
                                    if (statusDiv.textContent.includes('入場')) {
                                        statusDiv.style.color = statusColor;
                                        statusDiv.textContent = statusText;
                                    }
                                });
                            }
                        }
                    }
                });
            }
        }

        resetScanner() {
            this.stopScanning();
            this.state.lastScannedCode = null;
            this.currentTicketData = null; // 現在のチケットデータをクリア
            
            this.elements.resultContainer.classList.remove('show');
            this.elements.resultContainer.setAttribute('inert', '');
            this.elements.ticketInfo.style.display = 'none';
            
            this.elements.verifyBtn.textContent = '読み込み中';
            this.elements.verifyBtn.className = 'btn btn-success';
            this.elements.verifyBtn.style.background = '';
            this.elements.verifyBtn.style.color = '';
            this.elements.verifyBtn.style.border = '';
            this.elements.verifyBtn.disabled = false;
            
            // キャンセルボタンの文言を元に戻す
            if (this.elements.resetBtn) {
                this.elements.resetBtn.textContent = 'キャンセル';
            }
            
            this.updateStatus('ready', 'シャッターボタンを押してスキャン');
        }

        updateStatus(type, message) {
            this.elements.statusElement.className = 'status ' + type;
            this.elements.statusElement.textContent = message;
        }

        handleError(message, error) {
            console.error(message, error);
            this.showError(`${message}: ${error.message}`);
        }

        handleCameraError(message, error) {
            console.error(message, error);
            
            let userMessage = message;
            
            // エラータイプ別のメッセージ
            if (error.name === 'NotAllowedError') {
                userMessage = 'カメラのアクセスが拒否されました。ブラウザの設定でカメラを許可してください。';
            } else if (error.name === 'NotFoundError') {
                userMessage = 'カメラが見つかりません。カメラが接続されているか確認してください。';
            } else if (error.name === 'NotSupportedError') {
                userMessage = 'HTTPSが必要です。https:// のURLでアクセスしてください。';
            } else if (error.name === 'NotReadableError') {
                userMessage = 'カメラが他のアプリケーションで使用中です。';
            }
            
            this.showCameraPlaceholder();
            this.updateHeaderMessage('カメラエラー');
            this.showError(userMessage);
        }

        showCameraPlaceholder() {
            if (this.elements.cameraPlaceholder) {
                this.elements.cameraPlaceholder.style.display = 'block';
            }
        }

        hideCameraPlaceholder() {
            if (this.elements.cameraPlaceholder) {
                this.elements.cameraPlaceholder.style.display = 'none';
            }
        }

        updateHeaderMessage(message) {
            if (this.elements.headerMessage) {
                this.elements.headerMessage.textContent = message;
            }
        }

        async retryCamera() {
            this.updateHeaderMessage('カメラを再試行中...');
            this.hideCameraPlaceholder();
            await this.initCamera();
        }

        showError(message) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.classList.add('show');
            this.updateStatus('error', 'エラーが発生しました');
        }

        hideError() {
            this.elements.errorMessage.classList.remove('show');
        }

        cleanup() {
            if (this.state.animationFrameId) {
                cancelAnimationFrame(this.state.animationFrameId);
            }
            this.stopCurrentStream();
        }

        // テスト用：QRスキャンをシミュレート
        simulateQRScan(data) {
            if (!data || data.trim() === '') {
                alert('チケット番号または下4桁を入力してください');
                return;
            }
            
            const trimmedData = data.trim();
            
            // 手動入力パネルを閉じる
            document.getElementById('manualInput').style.display = 'none';
            
            // 短い文字列（4文字以下の英数字）は部分検索
            if (/^[a-zA-Z0-9]{1,4}$/.test(trimmedData)) {
                this.searchByPartialNumber(trimmedData);
            } else {
                // フル番号またはその他の形式
                this.handleQRCode(trimmedData);
            }
        }
        
        async searchByPartialNumber(partialNumber) {
            try {
                this.updateStatus('scanning', '部分番号で検索中...');
                
                // 1. まずキャッシュから高速検索
                if (window.dataSyncManager && window.dataSyncManager.ticketCache) {
                    const startTime = performance.now();
                    const matches = window.dataSyncManager.ticketCache.filter(ticket => 
                        ticket.ticketNumber && ticket.ticketNumber.toLowerCase().endsWith(partialNumber.toLowerCase())
                    );
                    const cacheTime = performance.now() - startTime;
                    
                    if (matches.length === 1) {
                        this.showTicketDetails(matches[0]);
                        this.displayResult(matches[0].ticketNumber);
                        this.updateStatus('success', '✅ チケットが見つかりました（キャッシュ）');
                        return;
                    } else if (matches.length > 1) {
                        this.updateStatus('error', `❌ 複数のチケットが見つかりました。より詳しい番号を入力してください`);
                        return;
                    } else {
                    }
                }
                
                // 2. キャッシュにない場合はAPI検索
                const apiStartTime = performance.now();
                const ticketData = await SheetsAPI.searchTicketByPartial(partialNumber);
                const apiTime = performance.now() - apiStartTime;
                
                if (ticketData) {
                    this.showTicketDetails(ticketData);
                    this.displayResult(partialNumber);
                    this.updateStatus('success', '✅ チケットが見つかりました（API）');
                } else {
                    this.updateStatus('error', `❌ 下4桁「${partialNumber}」に一致するチケットが見つかりません`);
                }
                
            } catch (error) {
                this.updateStatus('error', `❌ 検索中にエラーが発生しました: ${error.message}`);
            }
        }
        
    }

    // jsQRライブラリを動的に読み込む関数
    async function loadJsQR() {
        if (typeof jsQR !== 'undefined') {
            return true;
        }

        const cdnUrls = [
            'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
            'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js'
        ];

        for (const url of cdnUrls) {
            try {
                await loadScript(url);
                
                if (typeof jsQR !== 'undefined') {
                    return true;
                }
            } catch (error) {
            }
        }

        return false;
    }

    // スクリプトを動的に読み込むヘルパー関数
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // アプリケーション初期化
    document.addEventListener('DOMContentLoaded', async () => {
        // 必要な機能チェック
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('このブラウザはカメラ機能をサポートしていません');
            return;
        }

        // jsQRライブラリの確認・読み込み
        const jsQRLoaded = await loadJsQR();
        if (!jsQRLoaded) {
            const errorMsg = 'QRコード読み取りライブラリの読み込みに失敗しました。ページを再読み込みしてください。';
            alert(errorMsg);
            return;
        }

        // QRスキャナークラスをグローバルに公開（認証後に使用される）
        window.QRScanner = QRScanner;
    });

})();