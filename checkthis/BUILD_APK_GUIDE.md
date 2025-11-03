# 📱 Инструкция по сборке APK для RuStore

## 📋 Требования

### 1. Установить Java JDK 17
- Скачать: https://www.oracle.com/java/technologies/downloads/#java17
- Установить и добавить в PATH
- Проверка: `java -version`

### 2. Установить Android Studio
- Скачать: https://developer.android.com/studio
- Установить Android SDK Platform 34
- Установить Android Build Tools 34.0.0

### 3. Установить Node.js (если еще нет)
- Скачать: https://nodejs.org/
- Версия: 18.x или выше

## 🚀 Шаг 1: Установка зависимостей

```bash
npm install
```

Это установит:
- `@capacitor/core` - ядро Capacitor
- `@capacitor/cli` - CLI инструменты
- `@capacitor/android` - Android платформа

## 🔧 Шаг 2: Инициализация Capacitor

```bash
npx cap init
```

Если файл `capacitor.config.json` уже создан, пропустите этот шаг.

## 📱 Шаг 3: Добавить Android платформу

```bash
npx cap add android
```

Это создаст папку `android/` с нативным Android проектом.

## ⚙️ Шаг 4: Настроить приложение

### 4.1 Иконка приложения

Разместите иконки в `android/app/src/main/res/`:
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

### 4.2 Splash Screen

Отредактируйте `android/app/src/main/res/values/styles.xml`:

```xml
<resources>
    <style name="AppTheme.Launcher" parent="Theme.SplashScreen">
        <item name="android:windowBackground">@drawable/splash</item>
    </style>
</resources>
```

### 4.3 Права приложения

Отредактируйте `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

## 🔑 Шаг 5: Создать ключ подписи

```bash
cd android
keytool -genkey -v -keystore prizmatic-key.keystore -alias prizmatic -keyalg RSA -keysize 2048 -validity 10000
```

Вас спросят:
1. **Пароль keystore** - запомните его!
2. **Имя и Фамилия** - PRIZMATIC
3. **Организация** - PRIZMATIC
4. **Город** - Москва
5. **Область** - Москва
6. **Код страны** - RU

Сохраните файл `prizmatic-key.keystore` в безопасное место!

## 🔐 Шаг 6: Настроить подпись

Создайте файл `android/key.properties`:

```properties
storePassword=ВАШ_ПАРОЛЬ_KEYSTORE
keyPassword=ВАШ_ПАРОЛЬ_КЛЮЧА
keyAlias=prizmatic
storeFile=prizmatic-key.keystore
```

⚠️ **ВАЖНО**: Добавьте `key.properties` в `.gitignore`!

Отредактируйте `android/app/build.gradle`:

```gradle
// После android { ... добавьте:

def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

## 🏗️ Шаг 7: Собрать APK

### Синхронизировать проект:

```bash
npx cap sync android
```

### Открыть в Android Studio:

```bash
npx cap open android
```

В Android Studio:
1. **Build** → **Generate Signed Bundle / APK**
2. Выберите **APK**
3. Укажите путь к keystore
4. Введите пароли
5. Выберите **release**
6. Нажмите **Finish**

APK будет в `android/app/release/app-release.apk`

### ИЛИ собрать из командной строки:

```bash
cd android
./gradlew assembleRelease
```

(На Windows: `gradlew.bat assembleRelease`)

APK: `android/app/build/outputs/apk/release/app-release.apk`

## 📦 Шаг 8: Подготовка для RuStore

### 8.1 Требования RuStore:

- ✅ Подписанный APK
- ✅ minSdkVersion: 21 или выше
- ✅ targetSdkVersion: 33 или 34
- ✅ Иконка 512x512 PNG
- ✅ Скриншоты (минимум 2)
- ✅ Описание приложения
- ✅ Политика конфиденциальности

### 8.2 Проверить подпись:

```bash
jarsigner -verify -verbose -certs app-release.apk
```

### 8.3 Размер APK:

Рекомендуется < 50 МБ. Проверьте размер:

```bash
ls -lh app-release.apk
```

## 📸 Шаг 9: Подготовить материалы

### Иконка приложения (512x512):
Создайте в Figma/Photoshop или используйте существующую.

### Скриншоты:
- Минимум 2, максимум 8
- Разрешение: 1080x1920 (портрет) или 1920x1080 (ландшафт)
- Формат: PNG или JPG

### Описание:
**Короткое описание** (до 80 символов):
```
Аренда электровелосипедов PRIZMATIC - удобно и быстро
```

**Полное описание** (до 4000 символов):
```
PRIZMATIC - сервис аренды электровелосипедов в вашем городе.

🚴 Что мы предлагаем:
• Аренда современных электровелосипедов
• Гибкие тарифы (от 1 дня до месяца)
• Онлайн бронирование и оплата
• Доставка велосипеда к вам
• Круглосуточная поддержка

📱 Возможности приложения:
• Быстрая регистрация
• Просмотр доступных велосипедов
• Онлайн оплата картой
• Продление аренды
• История поездок
• Управление балансом

🔒 Безопасность:
• Все велосипеды застрахованы
• Договор онлайн
• Безопасные платежи

Присоединяйтесь к экологичному транспорту!
```

## 🚀 Шаг 10: Публикация в RuStore

1. Зарегистрируйтесь на https://console.rustore.ru/
2. Создайте новое приложение
3. Заполните информацию:
   - Название: **PRIZMATIC**
   - Категория: **Транспорт**
   - Возрастной рейтинг: **3+**
4. Загрузите:
   - APK файл
   - Иконку 512x512
   - Скриншоты (2-8 шт)
5. Укажите:
   - Описание
   - Ссылку на политику конфиденциальности
   - Контактный email
6. Отправьте на модерацию

Модерация занимает 1-3 рабочих дня.

## 🐛 Возможные проблемы

### Ошибка: "SDK location not found"
Создайте `android/local.properties`:
```
sdk.dir=C:\\Users\\ВАШ_ПОЛЬЗОВАТЕЛЬ\\AppData\\Local\\Android\\Sdk
```

### Ошибка: "Gradle build failed"
1. Обновите Gradle: в `android/gradle/wrapper/gradle-wrapper.properties` установите:
```
distributionUrl=https\://services.gradle.org/distributions/gradle-8.4-bin.zip
```
2. Очистите кеш:
```bash
cd android
./gradlew clean
```

### Ошибка: "Could not find or load main class"
Установите правильную версию Java JDK 17.

### APK слишком большой
- Используйте Android App Bundle (AAB) вместо APK
- Включите ProGuard/R8 для минификации
- Удалите неиспользуемые ресурсы

## 📝 Чеклист перед публикацией

- [ ] APK подписан release ключом
- [ ] Версия приложения указана правильно (versionCode, versionName)
- [ ] Иконка 512x512 создана
- [ ] Минимум 2 скриншота готовы
- [ ] Описание приложения написано
- [ ] Политика конфиденциальности опубликована
- [ ] Протестировано на реальном устройстве
- [ ] Все функции работают без интернета (если применимо)
- [ ] Нет крашей при запуске

## 🎉 Готово!

После публикации приложение появится в RuStore через 1-3 дня.

---

**Поддержка:**
- Email: support@prizmatic.ru
- Telegram: @prizmatic_support
