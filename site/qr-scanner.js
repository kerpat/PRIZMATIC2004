// qr-scanner.js

export function createQrScanner(onQrCodeScanned) {
    const modal = document.getElementById('qr-scanner-modal');
    const video = document.getElementById('qr-video');
    const closeBtn = document.getElementById('qr-scanner-close-btn');
    let stream = null;
    let animationFrameId = null;

    function stopScan() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
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
            video.play();
            animationFrameId = requestAnimationFrame(tick);
            modal.classList.remove('hidden');
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
