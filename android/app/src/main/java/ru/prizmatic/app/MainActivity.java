package ru.prizmatic.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    private static final int CAMERA_PERMISSION_REQUEST_CODE = 100;
    private PermissionRequest pendingPermissionRequest;
    
    // Для file input (фото паспорта при регистрации)
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private Uri cameraPhotoUri; // Временный Uri для фото с камеры

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate called");
        
        // Включаем WebView debugging для Chrome DevTools (chrome://inspect)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
            Log.d(TAG, "WebView debugging enabled");
        }
        
        // Регистрируем наш PaymentPlugin
        registerPlugin(PaymentPlugin.class);
        Log.d(TAG, "PaymentPlugin registered");
        
        // Регистрируем launcher для камеры
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (filePathCallback == null) return;
                
                Uri[] results = null;
                
                // Если фото сделано успешно, используем сохранённый Uri
                if (result.getResultCode() == RESULT_OK) {
                    if (cameraPhotoUri != null) {
                        results = new Uri[]{cameraPhotoUri};
                        Log.d(TAG, "Photo captured successfully: " + cameraPhotoUri);
                    }
                } else {
                    Log.d(TAG, "Photo capture cancelled or failed");
                }
                
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
                cameraPhotoUri = null;
            }
        );
    }

    @Override
    public void onStart() {
        super.onStart();
        Log.d(TAG, "onStart called, setting up WebView permissions");
        setupWebViewPermissions();
    }

    private void setupWebViewPermissions() {
        // Проверяем, что bridge и WebView готовы
        if (this.bridge == null || this.bridge.getWebView() == null) {
            Log.w(TAG, "Bridge or WebView not ready yet, will retry...");
            // Пробуем ещё раз через небольшую задержку
            this.bridge.getWebView().postDelayed(() -> {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    setupWebViewPermissionsInternal();
                }
            }, 100);
            return;
        }
        
        setupWebViewPermissionsInternal();
    }

    private void setupWebViewPermissionsInternal() {
        Log.d(TAG, "Setting up WebChromeClient for camera permissions and file chooser");
        
        this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            // Для getUserMedia (QR-сканер)
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                Log.d(TAG, "onPermissionRequest received");
                
                runOnUiThread(() -> {
                    boolean needsCameraPermission = false;
                    
                    for (String resource : request.getResources()) {
                        Log.d(TAG, "Requested resource: " + resource);
                        
                        if (resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                            needsCameraPermission = true;
                            break;
                        }
                    }
                    
                    if (!needsCameraPermission) {
                        Log.d(TAG, "No camera permission needed, passing to super");
                        super.onPermissionRequest(request);
                        return;
                    }
                    
                    if (ContextCompat.checkSelfPermission(MainActivity.this, 
                            Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        Log.d(TAG, "Camera permission already granted, granting to WebView");
                        request.grant(request.getResources());
                    } else {
                        Log.d(TAG, "Camera permission not granted, requesting from user");
                        pendingPermissionRequest = request;
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{Manifest.permission.CAMERA},
                                CAMERA_PERMISSION_REQUEST_CODE);
                    }
                });
            }
            
            // Для <input type="file"> (фото паспорта при регистрации)
            @Override
            public boolean onShowFileChooser(
                    android.webkit.WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                
                Log.d(TAG, "onShowFileChooser called - opening CAMERA ONLY");
                
                // Закрываем предыдущий callback если есть
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                
                MainActivity.this.filePathCallback = filePathCallback;
                
                // Проверяем разрешение на камеру
                if (ContextCompat.checkSelfPermission(MainActivity.this, 
                        Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "Camera permission not granted for file chooser, requesting...");
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.CAMERA},
                            CAMERA_PERMISSION_REQUEST_CODE);
                    return true;
                }
                
                // Создаём временный файл для фото
                File photoFile = null;
                try {
                    photoFile = createImageFile();
                } catch (IOException e) {
                    Log.e(TAG, "Error creating image file", e);
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                
                // Создаём Intent ТОЛЬКО для камеры (без выбора галереи)
                Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                
                if (photoFile != null) {
                    // Используем FileProvider для получения Uri
                    cameraPhotoUri = FileProvider.getUriForFile(
                        MainActivity.this,
                        "ru.prizmatic.app.fileprovider",
                        photoFile
                    );
                    
                    takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                    
                    try {
                        fileChooserLauncher.launch(takePictureIntent);
                        Log.d(TAG, "Camera launched successfully");
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to launch camera", e);
                        MainActivity.this.filePathCallback = null;
                        cameraPhotoUri = null;
                        return false;
                    }
                } else {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                
                return true;
            }
        });
        
        Log.d(TAG, "WebChromeClient setup completed");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, 
                                          @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        Log.d(TAG, "onRequestPermissionsResult: requestCode=" + requestCode);
        
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Camera permission GRANTED by user");
                
                // Для getUserMedia (QR-сканер)
                if (pendingPermissionRequest != null) {
                    runOnUiThread(() -> {
                        pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                        Log.d(TAG, "WebView permission request granted");
                        pendingPermissionRequest = null;
                    });
                }
                
                // Для file chooser (регистрация) - после разрешения открываем камеру
                if (filePathCallback != null) {
                    Log.d(TAG, "Re-triggering camera after permission grant");
                    // Запускаем камеру через небольшую задержку
                    runOnUiThread(() -> {
                        setupWebViewPermissionsInternal(); // Обновляем WebChromeClient
                    });
                }
            } else {
                Log.d(TAG, "Camera permission DENIED by user");
                
                if (pendingPermissionRequest != null) {
                    runOnUiThread(() -> {
                        pendingPermissionRequest.deny();
                        Log.d(TAG, "WebView permission request denied");
                        pendingPermissionRequest = null;
                    });
                }
                
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                    filePathCallback = null;
                }
                
                cameraPhotoUri = null;
            }
        }
    }
    
    // Создаём временный файл для фото
    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "PASSPORT_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        
        if (storageDir != null && !storageDir.exists()) {
            storageDir.mkdirs();
        }
        
        File imageFile = File.createTempFile(imageFileName, ".jpg", storageDir);
        Log.d(TAG, "Created temp image file: " + imageFile.getAbsolutePath());
        
        return imageFile;
    }
}
