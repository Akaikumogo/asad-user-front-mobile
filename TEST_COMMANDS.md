# Terminal orqali Test Qilish Qo'llanmasi

Appflow ga yuklashdan oldin barcha testlarni terminal orqali o'tkazish.

## 🚀 Tezkor Test (Barcha testlar)

```bash
# To'liq test (build + lint + sync + gradle)
npm run test:full
```

Yoki alohida script:

```bash
# Bash script orqali (batafsil natijalar)
npm run test:android
# yoki
./scripts/test-android.sh
```

## 📝 Alohida Testlar

### 1. TypeScript va Build Test

```bash
# TypeScript kompilatsiya va build
npm run test:build
```

Bu quyidagilarni bajaradi:
- TypeScript kompilatsiya tekshiruvi
- Vite build
- ESLint tekshiruvi

### 2. Lint Test

```bash
# Faqat lint tekshiruvi
npm run lint
```

### 3. Capacitor Sync

```bash
# Capacitor sync (web assets → Android)
npm run cap:sync
```

### 4. Gradle Build Test

```bash
# Android Debug APK build
npm run test:gradle
```

Yoki to'g'ridan-to'g'ri:

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

## 🔍 Batafsil Test Qadamlar

### Qadam 1: TypeScript va Build

```bash
# TypeScript xatolarni topish
npm run build
```

Agar xatolik bo'lsa, TypeScript xatolarni ko'rsatadi.

### Qadam 2: Lint Tekshiruvi

```bash
# Kod sifati tekshiruvi
npm run lint
```

### Qadam 3: Capacitor Sync

```bash
# Web assets ni Android ga ko'chirish
npx cap sync android
```

### Qadam 4: Gradle Clean

```bash
cd android
./gradlew clean
```

### Qadam 5: Debug APK Build

```bash
cd android
./gradlew assembleDebug
```

APK joylashuvi: `android/app/build/outputs/apk/debug/app-debug.apk`

### Qadam 6: APK ni Tekshirish

```bash
# APK faylini tekshirish
ls -lh android/app/build/outputs/apk/debug/app-debug.apk

# APK hajmini ko'rish
du -h android/app/build/outputs/apk/debug/app-debug.apk
```

## 📱 APK ni Qurilmaga O'rnatish

### USB orqali (ADB)

```bash
# Qurilma ulanganligini tekshirish
adb devices

# APK ni o'rnatish
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Yoki eski versiyani o'chirib, yangisini o'rnatish
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### APK ni Ko'chirish

```bash
# APK ni Desktop ga ko'chirish
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Desktop/

# Keyin qurilmaga ko'chirib, o'rnatish
```

## ✅ Test Checklist

Appflow ga yuklashdan oldin quyidagilarni tekshiring:

- [ ] `npm run build` - muvaffaqiyatli
- [ ] `npm run lint` - xatoliklar yo'q (yoki minimal)
- [ ] `npx cap sync android` - muvaffaqiyatli
- [ ] `./gradlew assembleDebug` - muvaffaqiyatli
- [ ] APK fayli yaratildi va hajmi normal
- [ ] APK ni qurilmada test qildingiz
- [ ] Barcha funksiyalar ishlayapti:
  - [ ] Login/Register
  - [ ] Device list
  - [ ] Real-time updates
  - [ ] Voice commands
  - [ ] Background monitoring
  - [ ] Notifications

## 🐛 Xatoliklar va Yechimlar

### Gradle Build Xatolik

```bash
# Gradle cache ni tozalash
cd android
./gradlew clean
./gradlew --stop
rm -rf .gradle
./gradlew assembleDebug
```

### Capacitor Sync Xatolik

```bash
# Node modules ni qayta o'rnatish
rm -rf node_modules
npm install
npx cap sync android
```

### TypeScript Xatolik

```bash
# TypeScript cache ni tozalash
rm -rf node_modules/.cache
npm run build
```

## 📊 Test Natijalari

Muvaffaqiyatli testdan keyin quyidagilar bo'lishi kerak:

1. ✅ TypeScript kompilatsiya - xatoliklar yo'q
2. ✅ Build fayllar - `dist/` papkasida
3. ✅ Capacitor sync - Android assets yangilandi
4. ✅ Gradle build - APK yaratildi
5. ✅ APK fayli - `android/app/build/outputs/apk/debug/app-debug.apk`

## 🚀 Appflow ga Yuklashga Tayyor

Barcha testlar muvaffaqiyatli o'tgandan keyin:

1. Git commit qiling
2. Git push qiling
3. Appflow da build trigger qiling

