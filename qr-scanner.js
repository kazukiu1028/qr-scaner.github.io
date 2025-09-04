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
                scannerLine: document.getElementById('scannerLine')
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

            // ページ離脱時の処理
            window.addEventListener('beforeunload', () => {
                this.cleanup();
            });
        }

        async initCamera() {
            try {
                const devices = await this.getVideoDevices();
                this.updateCameraList(devices);
                
                const defaultDevice = this.selectDefaultDevice(devices);
                if (defaultDevice) {
                    await this.startCamera(defaultDevice.deviceId);
                }
            } catch (error) {
                this.handleError('カメラへのアクセスが拒否されました', error);
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
                this.updateStatus('ready', 'シャッターボタンを押してスキャン');
            } catch (error) {
                this.handleError('カメラの起動に失敗しました', error);
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
                if (this.isSessionUrl(data)) {
                    this.displaySessionInfo(data);
                } else if (this.isJsonData(data)) {
                    this.displayJsonInfo(data);
                } else if (this.isUrl(data)) {
                    this.displayUrlInfo(data);
                }
            } catch (error) {
                console.error('チケットデータの解析エラー:', error);
            }
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
            // スタンドアロンでは簡易的な確認表示
            this.updateStatus('success', '✅ QRコードを確認しました');
            this.elements.verifyBtn.textContent = '確認済み';
            this.elements.verifyBtn.className = 'btn btn-secondary';
            this.elements.verifyBtn.disabled = true;
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
    }

    // アプリケーション初期化
    document.addEventListener('DOMContentLoaded', () => {
        // 必要な機能チェック
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('このブラウザはカメラ機能をサポートしていません');
            return;
        }

        if (typeof jsQR === 'undefined') {
            console.error('jsQRライブラリが読み込まれていません');
            return;
        }

        // QRスキャナー起動
        window.qrScanner = new QRScanner();
    });

})();