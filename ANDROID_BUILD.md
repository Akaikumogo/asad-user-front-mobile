# Android Build Qo'llanmasi

## Backend URL Sozlash

Backend URL allaqachon sozlangan:

- **API URL**: `https://asadbek.akaikumogo.uz/api/v1`
- **Socket URL**: `https://asadbek.akaikumogo.uz`

Bu ma'lumotlar endi **kod ichida statik** qilib qo'yilgan (qarang: `src/lib/api.ts` va `src/lib/socket.ts`).

## Android Build Qilish

### 1. Android Studio O'rnatish

1. Android Studio ni o'rnating: https://developer.android.com/studio
2. Android SDK ni o'rnating (API Level 33 yoki yuqori)
3. Java JDK 17 yoki yuqori versiyasini o'rnating

### 2. Android Studio da Loyihani Ochish

```bash
cd user-frontend
npx cap open android
```

Bu komanda Android Studio ni ochadi va loyihani yuklaydi.

### 3. Android Studio da Build Qilish

1. Android Studio ochilgandan keyin:

   - **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
   - Yoki **Build** → **Generate Signed Bundle / APK**

2. Release APK yaratish uchun:
   - **Build** → **Generate Signed Bundle / APK**
   - **APK** ni tanlang
   - KeyStore yarating yoki mavjud KeyStore dan foydalaning
   - APK yaratiladi: `android/app/build/outputs/apk/release/app-release.apk`

### 4. Terminal orqali Build Qilish (Gradle)

```bash
cd user-frontend/android
./gradlew assembleRelease
```

APK fayli: `android/app/build/outputs/apk/release/app-release.apk`

### 5. Debug APK (Test uchun)

```bash
cd user-frontend/android
./gradlew assembleDebug
```

APK fayli: `android/app/build/outputs/apk/debug/app-debug.apk`

## Muhim Eslatmalar

1. **Backend URL**: Backend URL kod ichida statik sozlangan (qarang: `src/lib/api.ts` va `src/lib/socket.ts`).

2. **Internet Permission**: Android manifest faylida internet ruxsati bo'lishi kerak (odatda avtomatik qo'shiladi).

3. **HTTPS**: Backend URL `https://` bilan boshlanadi, shuning uchun SSL sertifikat to'g'ri bo'lishi kerak.

4. **Network Security Config**: Agar kerak bo'lsa, `android/app/src/main/res/xml/network_security_config.xml` faylini yarating va backend domain ni qo'shing.

## Build Keyin

Build qilingan APK ni Android qurilmasiga o'rnatish:

```bash
# USB orqali
adb install android/app/build/outputs/apk/release/app-release.apk

# Yoki APK ni qurilmaga ko'chirib, o'rnatish
```

## Troubleshooting

1. **Gradle Sync Error**:

   ```bash
   cd android
   ./gradlew clean
   ```

2. **Build Error**: Android Studio da **File** → **Invalidate Caches / Restart**

3. **Network Error**: Backend URL ni tekshiring va internet ulanishini tekshiring.
