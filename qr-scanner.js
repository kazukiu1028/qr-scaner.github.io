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
        }
    };

    // モックデータ（デモ用）
    const MOCK_CUSTOMER_DATA = {
        'cs_test_123456789': {
            name: '田中 太郎',
            email: 'tanaka@example.com',
            phone: '090-1234-5678',
            event: '夏祭りコンサート',
            ticketType: 'VIP席',
            quantity: 2,
            amount: 15000,
            purchaseDate: '2024-09-01 14:30',
            status: 'paid'
        },
        'cs_test_987654321': {
            name: '佐藤 花子',
            email: 'sato@example.com',
            phone: '080-9876-5432',
            event: '秋の音楽フェス',
            ticketType: '一般席',
            quantity: 1,
            amount: 8000,
            purchaseDate: '2024-09-02 10:15',
            status: 'paid'
        },
        'cs_test_555666777': {
            name: '山田 次郎',
            email: 'yamada@example.com',
            phone: '070-5555-6666',
            event: 'クリスマス特別公演',
            ticketType: 'プレミアム席',
            quantity: 4,
            amount: 32000,
            purchaseDate: '2024-09-03 16:45',
            status: 'paid'
        }
    };

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
                flashBtn: document.getElementById('flashBtn'),
                scannerLine: document.getElementById('scannerLine'),
                headerMessage: document.getElementById('headerMessage'),
                cameraPlaceholder: document.getElementById('cameraPlaceholder'),
                retryCamera: document.getElementById('retryCamera')
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
            this.bindEvents();
            this.initCamera();
        }

        bindEvents() {
            // シャッターボタン
            this.elements.shutterBtn.addEventListener('click', () => {
                this.toggleScanning();
            });

            // 閉じるボタン
            this.elements.closeBtn.addEventListener('click', () => {
                this.closeCamera();
            });

            // フラッシュボタン（未実装）
            this.elements.flashBtn.addEventListener('click', () => {
                // フラッシュ機能は今回は省略
            });

            // カメラ選択変更
            this.elements.cameraSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.startCamera(e.target.value);
                }
            });

            // 確認ボタン（スタンドアロンでは簡易表示）
            this.elements.verifyBtn.addEventListener('click', () => {
                this.showVerificationResult();
            });

            // リセットボタン
            this.elements.resetBtn.addEventListener('click', () => {
                this.resetScanner();
            });

            // 再試行ボタン
            this.elements.retryCamera.addEventListener('click', () => {
                this.retryCamera();
            });

            // ページ離脱時の処理
            window.addEventListener('beforeunload', () => {
                this.cleanup();
            });
        }

        async initCamera() {
            try {
                // 許可状態をチェック
                await this.checkCameraPermissions();
                
                const devices = await this.getVideoDevices();
                this.updateCameraList(devices);
                
                const defaultDevice = this.selectDefaultDevice(devices);
                if (defaultDevice) {
                    await this.startCamera(defaultDevice.deviceId);
                }
            } catch (error) {
                this.handleCameraError('カメラへのアクセスが拒否されました', error);
            }
        }

        async checkCameraPermissions() {
            try {
                const permissions = await navigator.permissions.query({name: 'camera'});
                console.log('Camera permission state:', permissions.state);
                
                // HTTPS確認
                if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                    throw new Error('カメラ機能にはHTTPS接続が必要です');
                }
                
                return permissions.state;
            } catch (error) {
                console.warn('Permission check failed:', error);
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
            this.cleanup();
            // ここで前のページに戻るか、アプリを終了する処理
            if (history.length > 1) {
                history.back();
            } else {
                window.close();
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
            this.elements.resultContainer.setAttribute('aria-hidden', 'false');
        }

        parseTicketData(data) {
            try {
                // Session IDを抽出
                const sessionId = this.extractSessionId(data);
                if (sessionId) {
                    this.displayCustomerInfo(sessionId);
                } else if (this.isJsonData(data)) {
                    this.displayJsonInfo(data);
                } else if (this.isUrl(data)) {
                    this.displayUrlInfo(data);
                } else {
                    // 直接session_idの場合
                    if (data.startsWith('cs_test_') || data.startsWith('cs_')) {
                        this.displayCustomerInfo(data);
                    }
                }
            } catch (error) {
                console.error('チケットデータの解析エラー:', error);
            }
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

        async displayCustomerInfo(sessionId) {
            // モックデータから顧客情報を取得
            const customerData = MOCK_CUSTOMER_DATA[sessionId];
            
            if (customerData) {
                this.showCustomerDetails(customerData);
                this.updateStatus('success', '✅ チケットが確認されました');
            } else {
                this.showTicketInfo(`
                    <div style="color: #f44336;">
                        <strong>❌ チケットが見つかりません</strong><br>
                        <small>Session ID: ${this.escapeHtml(sessionId)}</small>
                    </div>
                `);
                this.updateStatus('error', 'チケットが見つかりません');
            }
        }

        showCustomerDetails(data) {
            const statusColor = data.status === 'paid' ? '#4CAF50' : '#f44336';
            const statusText = data.status === 'paid' ? '✅ 支払い済み' : '❌ 未払い';
            
            this.showTicketInfo(`
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 18px; color: #333;">${this.escapeHtml(data.name)}</strong>
                        <span style="color: ${statusColor}; font-weight: bold; font-size: 14px;">${statusText}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 2px;">メール</div>
                            <div style="font-size: 14px; font-weight: 500;">${this.escapeHtml(data.email)}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 2px;">電話番号</div>
                            <div style="font-size: 14px; font-weight: 500;">${this.escapeHtml(data.phone)}</div>
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                        <div style="font-size: 16px; font-weight: 600; color: #1976d2; margin-bottom: 8px;">
                            🎫 ${this.escapeHtml(data.event)}
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <span style="color: #666;">席種:</span>
                                <strong>${this.escapeHtml(data.ticketType)}</strong>
                            </div>
                            <div>
                                <span style="color: #666;">枚数:</span>
                                <strong>${data.quantity}枚</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                        <div>
                            <div style="font-size: 12px; color: #666;">購入金額</div>
                            <div style="font-size: 18px; font-weight: 700; color: #2e7d32;">¥${data.amount.toLocaleString()}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; color: #666;">購入日時</div>
                            <div style="font-size: 13px; font-weight: 500;">${data.purchaseDate}</div>
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

        showVerificationResult() {
            const btn = this.elements.verifyBtn;
            
            // ローディング表示
            btn.disabled = true;
            btn.innerHTML = '確認中... <span class="loading-spinner"></span>';
            
            // 1秒後に結果表示（実際のAPIコール風の演出）
            setTimeout(() => {
                this.updateStatus('success', '✅ 入場が承認されました');
                btn.textContent = '入場承認済み';
                btn.className = 'btn btn-success';
                btn.style.background = '#4CAF50';
                
                // 成功音を再生
                this.playSuccessSound();
                
                // 確認済みのマークを追加
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
            }, 1000);
        }

        resetScanner() {
            this.stopScanning();
            this.state.lastScannedCode = null;
            
            this.elements.resultContainer.classList.remove('show');
            this.elements.resultContainer.setAttribute('aria-hidden', 'true');
            this.elements.ticketInfo.style.display = 'none';
            
            this.elements.verifyBtn.textContent = '確認する';
            this.elements.verifyBtn.className = 'btn btn-success';
            this.elements.verifyBtn.disabled = false;
            
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
            this.elements.cameraPlaceholder.style.display = 'block';
        }

        hideCameraPlaceholder() {
            this.elements.cameraPlaceholder.style.display = 'none';
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
                alert('セッションIDを入力してください');
                return;
            }
            
            console.log('🧪 Simulating QR scan:', data);
            
            // 手動入力パネルを閉じる
            document.getElementById('manualInput').style.display = 'none';
            
            // QRスキャン処理をシミュレート
            this.handleQRCode(data.trim());
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
                console.log(`Trying to load jsQR from: ${url}`);
                await loadScript(url);
                
                if (typeof jsQR !== 'undefined') {
                    console.log('✅ jsQR loaded successfully');
                    return true;
                }
            } catch (error) {
                console.warn(`Failed to load jsQR from ${url}:`, error);
            }
        }

        console.error('❌ All jsQR CDN attempts failed');
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
            console.error(errorMsg);
            return;
        }

        // QRスキャナー起動
        window.qrScanner = new QRScanner();
    });

})();