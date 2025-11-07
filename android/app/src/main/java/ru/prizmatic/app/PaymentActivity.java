package ru.prizmatic.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

/**
 * 💳 Activity для оплаты - открывается поверх приложения
 * Все редиректы (ЮКасса, банки, 3DS) остаются внутри!
 */
public class PaymentActivity extends Activity {
    
    private static final String TAG = "PaymentActivity";
    private WebView webView;
    private ProgressBar progressBar;
    
    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "═════════════════════════════════════");
        Log.d(TAG, "💳 PaymentActivity.onCreate() вызвана");
        
        // Получаем URL из Intent
        String url = getIntent().getStringExtra("url");
        Log.d(TAG, "📍 URL из Intent: " + url);
        
        if (url == null || url.isEmpty()) {
            Log.e(TAG, "❌ URL не указан или пустой!");
            finish();
            return;
        }
        
        Log.d(TAG, "✅ URL валиден");
        Log.d(TAG, "🎨 Создаём layout...");
        
        // Создаём layout программно
        setupLayout();
        
        Log.d(TAG, "✅ Layout создан");
        Log.d(TAG, "🌐 Настраиваем WebView...");
        
        // Настраиваем WebView
        setupWebView(url);
        
        Log.d(TAG, "✅ WebView настроен и загружает URL");
        Log.d(TAG, "═════════════════════════════════════");
    }
    
    private void setupLayout() {
        // ProgressBar
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#2d6a4f")));
        
        // WebView
        webView = new WebView(this);
        
        // Layout
        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.WHITE);
        
        // Добавляем элементы
        layout.addView(progressBar, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            8
        ));
        layout.addView(webView, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT
        ));
        
        setContentView(layout);
    }
    
    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView(String url) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        
        // WebViewClient - перехватываем навигацию
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String loadUrl = request.getUrl().toString();
                Log.d(TAG, "🔄 Навигация на: " + loadUrl);
                
                // Проверяем возврат в приложение
                boolean isReturn = loadUrl.contains("payment-return") || 
                                   loadUrl.contains("prizmatic://") ||
                                   loadUrl.contains("prizmatic-2004.vercel.app/main.html");
                
                if (isReturn) {
                    Log.d(TAG, "🎉 Возврат обнаружен!");
                    Log.d(TAG, "🔙 Закрываем PaymentActivity и возвращаемся в MainActivity");
                    
                    // Возвращаемся в главное приложение
                    Intent intent = new Intent(PaymentActivity.this, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(intent);
                    finish();
                    return true;
                }
                
                Log.d(TAG, "➡️ Загружаем URL в текущем WebView");
                // Все остальные URL открываем в текущем WebView
                view.loadUrl(loadUrl);
                return true;
            }
            
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                Log.d(TAG, "🌐 Начата загрузка: " + url);
            }
            
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d(TAG, "✅ Страница загружена: " + url);
                progressBar.setVisibility(View.GONE);
            }
            
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.e(TAG, "❌ Ошибка загрузки страницы!");
                Log.e(TAG, "URL: " + failingUrl);
                Log.e(TAG, "Код: " + errorCode);
                Log.e(TAG, "Описание: " + description);
            }
        });
        
        // WebChromeClient - прогресс загрузки
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                super.onProgressChanged(view, newProgress);
                progressBar.setProgress(newProgress);
                
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });
        
        // Загружаем URL
        webView.loadUrl(url);
    }
    
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
    
    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}

