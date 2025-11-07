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
        
        // ⚡ Критично для 3DS!
        settings.setSupportMultipleWindows(false); // Запрещаем попапы - всё в одном окне
        settings.setJavaScriptCanOpenWindowsAutomatically(false); // JS не может открыть новое окно
        settings.setAllowFileAccess(false); // Безопасность
        settings.setAllowContentAccess(true); // Разрешаем content://
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); // HTTP + HTTPS
        
        // 🎭 User Agent - важно для некоторых платёжных систем
        String userAgent = settings.getUserAgentString();
        settings.setUserAgentString(userAgent + " PrizmaticApp/1.0");
        
        // 💾 Кэширование для стабильности
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // App cache deprecated и удален из Android API
        
        Log.d(TAG, "✅ WebSettings настроены для 3DS");
        Log.d(TAG, "🎭 User-Agent: " + settings.getUserAgentString());
        
        // WebViewClient - перехватываем навигацию
        webView.setWebViewClient(new WebViewClient() {
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Deprecated метод для старых версий Android
                return handleUrlLoading(url);
            }
            
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Новый метод для Android 24+
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                    return handleUrlLoading(request.getUrl().toString());
                }
                return false;
            }
            
            private boolean handleUrlLoading(String loadUrl) {
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
                
                // Проверяем специальные схемы (банковские приложения, intent://)
                if (!loadUrl.startsWith("http://") && !loadUrl.startsWith("https://")) {
                    Log.w(TAG, "⚠️ Нестандартная схема: " + loadUrl);
                    Log.w(TAG, "🏦 Возможно, это банковское приложение");
                    
                    try {
                        Intent intent;
                        
                        // Обработка intent:// схемы
                        if (loadUrl.startsWith("intent://")) {
                            intent = Intent.parseUri(loadUrl, Intent.URI_INTENT_SCHEME);
                        } else {
                            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(loadUrl));
                        }
                        
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        Log.d(TAG, "✅ Запущено внешнее приложение");
                        return true;
                        
                    } catch (Exception e) {
                        Log.e(TAG, "❌ Не удалось открыть внешнее приложение: " + e.getMessage());
                        return true;
                    }
                }
                
                Log.d(TAG, "➡️ Загружаем URL в WebView (return false = WebView обработает)");
                // Возвращаем false - позволяем WebView обработать URL самостоятельно
                // Это критично для 3DS редиректов!
                return false;
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
            
            @Override
            public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
                Log.e(TAG, "⚠️ SSL ОШИБКА!");
                Log.e(TAG, "URL: " + error.getUrl());
                Log.e(TAG, "Ошибка: " + error.toString());
                
                // ⚠️ НЕ используйте handler.proceed() в продакшене без проверок!
                // Это небезопасно! Здесь только для диагностики.
                // В реальном приложении покажите диалог пользователю.
                
                super.onReceivedSslError(view, handler, error);
                // handler.cancel(); - отменяем загрузку при SSL ошибке
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

