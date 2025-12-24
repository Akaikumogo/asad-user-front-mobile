#!/bin/bash

# Android Test Script
# Bu script loyihani build qilishdan oldin barcha testlarni o'tkazadi

set -e  # Xatolik bo'lsa to'xtatish

echo "🚀 Android Test Script boshlanmoqda..."
echo ""

# 1. TypeScript tekshiruvi
echo "📝 1. TypeScript kompilatsiya tekshiruvi..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ TypeScript kompilatsiya muvaffaqiyatli!"
else
    echo "❌ TypeScript xatolik topildi!"
    exit 1
fi
echo ""

# 2. Lint tekshiruvi
echo "🔍 2. ESLint tekshiruvi..."
npm run lint
if [ $? -eq 0 ]; then
    echo "✅ ESLint tekshiruvi muvaffaqiyatli!"
else
    echo "⚠️  ESLint ogohlantirishlar topildi (build davom etadi)"
fi
echo ""

# 3. Capacitor sync
echo "🔄 3. Capacitor sync..."
npx cap sync android
if [ $? -eq 0 ]; then
    echo "✅ Capacitor sync muvaffaqiyatli!"
else
    echo "❌ Capacitor sync xatolik!"
    exit 1
fi
echo ""

# 4. Android Gradle clean
echo "🧹 4. Gradle clean..."
cd android
./gradlew clean
if [ $? -eq 0 ]; then
    echo "✅ Gradle clean muvaffaqiyatli!"
else
    echo "❌ Gradle clean xatolik!"
    exit 1
fi
echo ""

# 5. Android build test (debug)
echo "🔨 5. Android Debug APK build..."
./gradlew assembleDebug
if [ $? -eq 0 ]; then
    echo "✅ Debug APK build muvaffaqiyatli!"
    echo "📦 APK joylashuvi: android/app/build/outputs/apk/debug/app-debug.apk"
else
    echo "❌ Debug APK build xatolik!"
    exit 1
fi
echo ""

# 6. APK faylini tekshirish
echo "📱 6. APK faylini tekshirish..."
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo "✅ APK yaratildi: $APK_SIZE"
    echo "📍 To'liq yo'l: $(pwd)/$APK_PATH"
else
    echo "❌ APK fayli topilmadi!"
    exit 1
fi
echo ""

cd ..

echo "🎉 Barcha testlar muvaffaqiyatli o'tdi!"
echo ""
echo "📱 Keyingi qadamlar:"
echo "   1. APK ni qurilmaga o'rnatish: adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo "   2. Yoki APK ni qurilmaga ko'chirib, o'rnatish"
echo "   3. Appflow ga yuklashga tayyor!"

