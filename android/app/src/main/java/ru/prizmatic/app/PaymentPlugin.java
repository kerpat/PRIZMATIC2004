package ru.prizmatic.app;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 💳 Capacitor плагин для открытия оплаты
 */
@CapacitorPlugin(name = "PaymentBrowser")
public class PaymentPlugin extends Plugin {
    
    private static final String TAG = "PaymentPlugin";
    
    @PluginMethod
    public void open(PluginCall call) {
        Log.d(TAG, "═════════════════════════════════════");
        Log.d(TAG, "🚀 PaymentPlugin.open() вызван из JS");
        
        String url = call.getString("url");
        Log.d(TAG, "📍 Полученный URL: " + url);
        
        if (url == null || url.isEmpty()) {
            Log.e(TAG, "❌ URL не указан или пустой!");
            call.reject("URL не указан");
            return;
        }
        
        Log.d(TAG, "✅ URL валиден, запускаем PaymentActivity...");
        
        try {
            // Запускаем PaymentActivity
            Intent intent = new Intent(getActivity(), PaymentActivity.class);
            intent.putExtra("url", url);
            
            Log.d(TAG, "📦 Intent создан: " + intent.toString());
            Log.d(TAG, "🎯 Запускаем Activity...");
            
            getActivity().startActivity(intent);
            
            Log.d(TAG, "✅ PaymentActivity запущена успешно!");
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("url", url);
            
            call.resolve(result);
            Log.d(TAG, "✅ Результат отправлен в JS");
            Log.d(TAG, "═════════════════════════════════════");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Ошибка при запуске PaymentActivity!", e);
            Log.e(TAG, "Сообщение: " + e.getMessage());
            Log.e(TAG, "Стек: " + Log.getStackTraceString(e));
            call.reject("Ошибка запуска: " + e.getMessage());
            Log.d(TAG, "═════════════════════════════════════");
        }
    }
}

