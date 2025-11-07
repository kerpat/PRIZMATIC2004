// qr-scanner.js

export function createQrScanner(onQrCodeScanned) {
    const modal = document.getElementById('qr-scanner-modal');
    const video = document.getElementById('qr-video');
    const closeBtn = document.getElementById('qr-scanner-close-btn');
    const container = modal?.querySelector('.qr-scanner-container');
    const fallbackInput = document.createElement('input');
    fallbackInput.type = 'file';
    fallbackInput.accept = 'image/*';
    fallbackInput.capture = 'environment';
    fallbackInput.style.display = 'none';
    modal?.appendChild(fallbackInput);
    
    if (!modal || !video || !closeBtn || !container) {
        console.warn('[QR Scanner] Required DOM nodes not found.');
        return {
            startScan: () => alert('Сканер QR-кодов недоступен. Обновите страницу и попробуйте снова.'),
            stopScan: () => {},
        };
    }
    let stream = null;
    let animationFrameId = null;
    let isScanning = false; // 🔒 Защита от повторных вызовов

    function resetVideoFrame() {
        if (container) {
            container.style.height = 'clamp(280px, 58vh, 540px)';
        }
        if (video) {
            video.style.objectFit = 'cover';
        }
    }

    function updateVideoFrame() {
        if (!container || !video || !stream) return;

        const settings = stream?.getVideoTracks?.()[0]?.getSettings?.();
        const trackWidth = settings?.width;
        const trackHeight = settings?.height;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        const width = trackWidth || videoWidth;
        const height = trackHeight || videoHeight;

        if (width && height) {
            const ratio = height / width;
            const targetHeight = container.offsetWidth * ratio;
            const clamped = Math.max(260, Math.min(targetHeight, window.innerHeight * 0.9));
            container.style.height = `${clamped}px`;
            video.style.objectFit = ratio >= 1 ? 'cover' : 'contain';
        }
    }

    function stopScan() {
        console.log('[QR Scanner] Остановка сканирования');
        isScanning = false; // 🔓 Разблокируем возможность нового сканирования
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
                console.log('[QR Scanner] Камера остановлена:', track.label);
            });
            stream = null;
        }
        if (video) {
            video.pause();
            video.srcObject = null;
        }
        resetVideoFrame();
        window.removeEventListener('resize', updateVideoFrame);
        modal.classList.add('hidden');
    }

    function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvasElement = document.createElement('canvas');
            const canvas = canvasElement.getContext('2d');
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
            });

            if (code) {
                stopScan();
                onQrCodeScanned(code.data);
            }
        }
        animationFrameId = requestAnimationFrame(tick);
    }

    async function decodeQrFromFile(file) {
        if (!file) return null;

        const imageUrl = URL.createObjectURL(file);
        try {
            const img = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = imageUrl;
            });

            const canvasElement = document.createElement('canvas');
            canvasElement.width = img.naturalWidth || img.width;
            canvasElement.height = img.naturalHeight || img.height;

            const canvas = canvasElement.getContext('2d');
            if (!canvas) return null;

            canvas.drawImage(img, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
            return code?.data || null;
        } catch (error) {
            console.warn('[QR Scanner] Не удалось декодировать QR с изображения:', error);
            return null;
        } finally {
            URL.revokeObjectURL(imageUrl);
        }
    }

    async function runPhotoScanFallback() {
        return new Promise((resolve) => {
            const handleFallbackCapture = async (event) => {
                fallbackInput.removeEventListener('change', handleFallbackCapture);
                const file = event.target?.files?.[0];
                fallbackInput.value = '';

                const decoded = await decodeQrFromFile(file);
                if (decoded) {
                    onQrCodeScanned(decoded);
                    resolve(true);
                    return;
                }

                alert('Не удалось распознать QR-код. Попробуйте сфотографировать его ещё раз с хорошим освещением.');
                resolve(false);
            };

            fallbackInput.addEventListener('change', handleFallbackCapture, { once: true });
            fallbackInput.click();
        });
    }

    async function getCameraStream() {
        const mediaDevices = navigator.mediaDevices;
        if (!mediaDevices?.getUserMedia) {
            const error = new Error('MEDIA_DEVICES_UNAVAILABLE');
            error.code = 'MEDIA_DEVICES_UNAVAILABLE';
            throw error;
        }

        try {
            return await mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        ideal: 'environment',
                    },
                },
            });
        } catch (err) {
            if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
                // Fallback to any available camera if the environment camera is unavailable.
                return mediaDevices.getUserMedia({ video: true });
            }
            throw err;
        }
    }

    async function startScan() {
        // 🔒 Защита от повторных одновременных вызовов
        if (isScanning) {
            console.warn('[QR Scanner] Сканирование уже запущено, игнорируем повторный вызов');
            return;
        }
        
        isScanning = true;
        console.log('[QR Scanner] Запуск сканирования...');
        
        try {
            // Останавливаем предыдущий поток, если он есть
            if (stream) {
                console.log('[QR Scanner] Останавливаем предыдущий поток камеры');
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            
            stream = await getCameraStream();
            console.log('[QR Scanner] Камера получена успешно:', stream.getVideoTracks()[0]?.label);
            
            video.srcObject = stream;
            video.setAttribute('playsinline', true); // Required to work on iOS
            modal.classList.remove('hidden');
            await video.play();
            console.log('[QR Scanner] Видео запущено');
            
            updateVideoFrame();
            animationFrameId = requestAnimationFrame(tick);
            window.addEventListener('resize', updateVideoFrame, { passive: true });
            video.addEventListener('loadedmetadata', updateVideoFrame, { once: true });
        } catch (err) {
            console.error('[QR Scanner] Ошибка доступа к камере:', err);
            isScanning = false; // 🔓 Разблокируем при ошибке
            
            let message = 'Не удалось получить доступ к камере. Проверьте разрешения в настройках браузера.';
            let fallbackHandled = false;

            if (err?.code === 'MEDIA_DEVICES_UNAVAILABLE') {
                message = 'Ваш браузер не поддерживает доступ к камере. Откройте сервис в современном браузере или обновите текущий.';
                console.log('[QR Scanner] MediaDevices недоступны, запуск fallback');
                fallbackHandled = await runPhotoScanFallback();
            } else if (err?.name === 'NotAllowedError') {
                console.log('[QR Scanner] Разрешение отклонено пользователем');
                let permissionState = null;
                try {
                    const permissionQuery = navigator.permissions?.query?.({ name: 'camera' });
                    if (permissionQuery) {
                        permissionState = await permissionQuery;
                    }
                } catch (_) {
                    permissionState = null;
                }
                
                console.log('[QR Scanner] Состояние разрешения:', permissionState?.state);
                
                if (permissionState?.state === 'denied') {
                    message = 'Доступ к камере был запрещён. Разрешите использование камеры в настройках браузера или системы и попробуйте снова.';
                } else {
                    message = 'Камера заблокирована. Обновите страницу и предоставьте разрешение, когда браузер запросит его.';
                }
                if (permissionState?.state !== 'denied') {
                    console.log('[QR Scanner] Запуск fallback для загрузки фото');
                    fallbackHandled = await runPhotoScanFallback();
                }
            } else if (err?.name === 'NotFoundError') {
                console.log('[QR Scanner] Камера не найдена');
                message = 'Камера не найдена. Убедитесь, что устройство подключено и доступно для использования.';
            } else if (err?.name === 'SecurityError') {
                console.log('[QR Scanner] Ошибка безопасности');
                message = 'Для доступа к камере откройте приложение через HTTPS или добавьте сайт в доверенные в настройках браузера.';
                fallbackHandled = await runPhotoScanFallback();
            } else if (err?.name === 'AbortError') {
                console.log('[QR Scanner] Запрос камеры прерван (возможно, множественные вызовы)');
                message = 'Запрос камеры был прерван. Попробуйте ещё раз через пару секунд.';
            }

            if (!fallbackHandled) {
                alert(message);
            }
        }
    }

    closeBtn.addEventListener('click', stopScan);

    return {
        startScan,
        stopScan,
    };
}
