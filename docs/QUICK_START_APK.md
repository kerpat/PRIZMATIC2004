# 🚀 Быстрый старт: Сборка APK

## ⚡ За 5 шагов до APK

### Шаг 1: Установить требования
1. **Java JDK 17**: https://www.oracle.com/java/technologies/downloads/#java17
2. **Android Studio**: https://developer.android.com/studio
3. **Node.js 18+**: https://nodejs.org/

### Шаг 2: Установить зависимости
```bash
npm install
```

### Шаг 3: Запустить автоматический билдер
```bash
build-apk.bat
```

Или вручную:
```bash
npx cap add android
npx cap sync android
npx cap open android
```

### Шаг 4: Создать ключ подписи (ОДИН РАЗ!)
```bash
cd android
keytool -genkey -v -keystore prizmatic-key.keystore -alias prizmatic -keyalg RSA -keysize 2048 -validity 10000
```

Введите пароль и сохраните его!

### Шаг 5: Собрать APK в Android Studio
1. Build → Generate Signed Bundle / APK
2. Select APK
3. Укажите keystore и пароль
4. Select **release**
5. Finish

**APK готов!** 🎉
Путь: `android/app/release/app-release.apk`

---

## 📦 Или из командной строки:

```bash
cd android
gradlew assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🔍 Проверить подпись:

```bash
jarsigner -verify -verbose -certs app-release.apk
```

---

## 📤 Загрузить в RuStore:

1. https://console.rustore.ru/
2. Создать приложение
3. Загрузить APK
4. Добавить иконку 512x512
5. Добавить 2+ скриншота
6. Заполнить описание
7. Отправить на модерацию

Готово! 🚀

---

## 🆘 Проблемы?

Смотрите полную инструкцию: `BUILD_APK_GUIDE.md`

Или пишите: support@prizmatic.ru
