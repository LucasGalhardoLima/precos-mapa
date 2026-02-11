# Quickstart: PrecoMapa Consumer App Demo

**Feature**: `001-grocery-price-compare`
**Date**: 2026-02-10

## Prerequisites

- Node.js 18+ (LTS)
- npm or yarn
- Expo CLI: `npx expo` (no global install needed)
- iOS Simulator (macOS) or Android Emulator, or Expo Go app on
  a physical device
- Google Maps API key (for Android map support)

## Setup

```bash
# From repository root
cd mobile

# Install dependencies
npm install

# Start the Expo dev server
npx expo start
```

## Running the Demo

### Option 1: Expo Go (quickest, physical device)

1. Install "Expo Go" from App Store or Google Play
2. Run `npx expo start` in the `mobile/` directory
3. Scan the QR code with your phone camera (iOS) or Expo Go app
   (Android)

**Note**: react-native-maps works in Expo Go with Apple Maps on iOS.
For Google Maps on Android, a development build is required.

### Option 2: iOS Simulator (macOS)

```bash
npx expo start --ios
```

### Option 3: Android Emulator

```bash
npx expo start --android
```

### Option 4: Development Build (full native features)

```bash
# Build locally (requires Xcode / Android Studio)
npx expo run:ios
npx expo run:android
```

## Google Maps API Key (Android)

For Android map support, add a Google Maps API key to `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_GOOGLE_MAPS_API_KEY"
        }
      }
    }
  }
}
```

## Demo Walkthrough

1. **Onboarding**: App opens to the onboarding screen showing
   PrecoMapa brand, Matao/SP location, social proof stats, user
   testimonials, featured deals carousel, and two CTAs.

2. **Consumer Entry**: Tap "Sou Consumidor" to enter the consumer
   app (auth is simulated — tap to proceed).

3. **Home Tab**: Browse deals via filter chips ("Mais barato", "Mais
   perto", "Acaba hoje"), category tabs ("Bebidas", "Limpeza", etc.),
   and the "Perto de voce" section. Use the search bar to find
   specific products.

4. **Map Tab**: See an interactive map centered on Matao/SP with 4
   store markers. Tap any marker to see a bottom sheet with store
   info and top 3 deals.

5. **Favorites Tab**: View a pre-populated list of saved products
   with their current best prices (static mockup).

6. **Alerts Tab**: Placeholder screen showing what deal alerts would
   look like (static).

## Project Structure

```
mobile/
├── app/           # Expo Router screens
├── components/    # Reusable UI components
├── data/          # Mock data modules
├── hooks/         # Data access hooks
├── store/         # Zustand state
├── constants/     # Design tokens, messages
└── types/         # TypeScript definitions
```

## Troubleshooting

- **Map not loading on Android**: Ensure Google Maps API key is set
  in `app.json` and use a development build (not Expo Go)
- **NativeWind styles not applying**: Run `npx expo start --clear`
  to reset the Metro bundler cache
- **Slow first load**: Normal for development; production builds
  are significantly faster
