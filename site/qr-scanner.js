// qr-scanner.js

export function createQrScanner(onQrCodeScanned) {
    const modal = document.getElementById('qr-scanner-modal');
    const video = document.getElementById('qr-video');
    const closeBtn = document.getElementById('qr-scanner-close-btn');
    const container = modal?.querySelector('.qr-scanner-container');
    
    if (!modal || !video || !closeBtn || !container) {
        console.warn('[QR Scanner] Required DOM nodes not found.');
        return {
            startScan: () => alert('Сканер QR-кодов недоступен. Обновите страницу и попробуйте снова.'),
            stopScan: () => {},
        };
    }
    let stream = null;
    let animationFrameId = null;

    function resetVideoFrame() {
        if (container) {
            container.style.height = 'clamp(280px, 58vh, 540px)';
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
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
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

    async function startScan() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            video.setAttribute('playsinline', true); // Required to work on iOS
            modal.classList.remove('hidden');
            await video.play();
            updateVideoFrame();
            animationFrameId = requestAnimationFrame(tick);
            window.addEventListener('resize', updateVideoFrame, { passive: true });
            video.addEventListener('loadedmetadata', updateVideoFrame, { once: true });
        } catch (err) {
            console.error('Error accessing camera', err);
            alert('Не удалось получить доступ к камере. Проверьте разрешения в настройках браузера.');
        }
    }

    closeBtn.addEventListener('click', stopScan);

    return {
        startScan,
        stopScan,
    };
}
