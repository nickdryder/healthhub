# HealthHub

A comprehensive health tracking and insights app built with Expo and React Native.

## Features

- 📊 Health data integration (Apple Health, Fitbit, Google Calendar)
- 🧠 AI-powered health insights and correlations
- 📈 Trend visualization and tracking
- 🔒 Secure cycle tracking with AES-256 encryption
- 📝 Manual logging for symptoms, exercise, medications, and more
- 🌙 Dark mode support
- ♿ Accessibility optimized (WCAG compliant)

## Tech Stack

- **Expo SDK 53** – React Native app development
- **React Native** – Cross-platform mobile apps
- **TypeScript** – Type-safe JavaScript
- **expo-router** – File-based navigation
- **Supabase** – Backend and database
- **React Query** – Data fetching and caching
- **HealthKit** – Apple Health integration
- **Expo Secure Store** – Hardware-backed encryption

## Getting Started

### Prerequisites

- Node.js 18+ ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- npm or bun
- Expo Go app (for testing on device)

### Installation

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd healthhub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**
   ```bash
   npm start
   ```

   Scan the QR code with Expo Go or run in an emulator.

## Publishing to TestFlight

This app uses EAS Build for cloud-based iOS builds:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure

# Build for iOS
npx eas-cli build --platform ios --profile production

# Submit to TestFlight
npx eas-cli submit --platform ios
```

## Project Structure

```
healthhub/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation screens
│   └── ...                # Other screens
├── components/            # Reusable React components
├── services/              # Business logic and API integrations
├── hooks/                 # Custom React hooks
├── providers/             # React context providers
├── constants/             # App constants and configuration
├── utils/                 # Utility functions
└── types/                 # TypeScript type definitions
```

## Security Features

- AES-256-CBC encryption for sensitive cycle data
- Hardware-backed key storage using Expo Secure Store
- XSS protection with input sanitization
- Supabase Row Level Security (RLS) for database
- No hardcoded credentials (environment variables only)

## Contributing

This is a personal health tracking app. If you'd like to contribute or report issues, please open an issue or pull request.

## License

Private project - All rights reserved

---

Built with ❤️ by Riley Hansen
