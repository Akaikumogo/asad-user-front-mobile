# Water System User Frontend

Mobile-first user interface for Water System Management with real-time updates, Capacitor JS integration, and HeroUI components.

## Features

- 📱 **Mobile-First Design** - Optimized for mobile devices
- 🔐 **Authentication** - Login and Registration with full validation
- 🔄 **Real-Time Updates** - WebSocket integration for live device data
- 💾 **Capacitor Storage** - Secure storage for mobile apps
- 🎨 **HeroUI Components** - Beautiful, accessible UI components
- ✅ **100% Validation** - Complete form validation with Zod
- 🌐 **Multi-language** - Support for Uzbek, English, Russian
- 📊 **Device Monitoring** - Real-time device status and metrics
- ♿ **Accessible** - Full accessibility support

## Tech Stack

- React 18 + TypeScript
- Vite
- HeroUI (https://heroui.com/)
- Capacitor JS
- Socket.IO Client
- React Hook Form + Zod
- Zustand
- i18next

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3001`

### Build for Production

```bash
npm run build
```

### Mobile Build with Capacitor

```bash
# Sync Capacitor
npm run cap:sync

# Open iOS
npm run cap:ios

# Open Android
npm run cap:android
```

## Environment Variables

Backend URL hozircha statik qilib qo‘yilgan (Capacitor/mobile build uchun qulay):

- **API URL**: `https://asadbek.akaikumogo.uz/api/v1` (qarang: `src/lib/api.ts`)
- **Socket URL**: `https://asadbek.akaikumogo.uz` (qarang: `src/lib/socket.ts`)

Agar keyinroq o‘zgartirmoqchi bo‘lsangiz, shu 2ta fayldagi konstantalarni almashtirasiz.

## Project Structure

```
user-frontend/
├── src/
│   ├── pages/         # Page components
│   ├── components/    # Reusable components
│   ├── hooks/         # Custom hooks
│   ├── store/         # Zustand stores
│   ├── lib/           # API, storage, socket
│   ├── i18n/          # Internationalization
│   ├── types/         # TypeScript types
│   └── utils/         # Utilities (validations)
├── capacitor.config.ts
└── package.json
```

## Features Details

### Authentication
- Login with username/password
- Registration with password confirmation
- Full form validation
- Secure token storage via Capacitor

### Real-Time Updates
- WebSocket connection for live data
- Automatic reconnection
- Fallback to polling if WebSocket fails
- Device status updates in real-time

### Device Monitoring
- List of user's assigned devices
- Device detail view with all metrics
- Real-time status updates
- Power usage, water depth, and more

### Storage
- Uses Capacitor Preferences (works on web and mobile)
- Secure token storage
- User data persistence

## License

MIT

