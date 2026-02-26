/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|moti|@gorhom/.*|nativewind|react-native-reanimated|lucide-react-native|@supabase/.*|react-native-purchases|@react-native-google-signin/.*|expo-apple-authentication|expo-location|expo-notifications|expo-secure-store|expo-device|expo-constants|@precomapa/.*)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@precomapa/shared$': '<rootDir>/../packages/shared/src/index.ts',
    '^@precomapa/shared/(.*)$': '<rootDir>/../packages/shared/src/$1',
    // Force native modules to resolve from mobile/node_modules so jest.mock
    // in jest.setup.ts matches the same resolved path for imports from packages/shared
    '^expo-secure-store$': '<rootDir>/node_modules/expo-secure-store',
    '^expo-location$': '<rootDir>/node_modules/expo-location',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '__tests__/helpers/(?!.*\\.test\\.)'],
  collectCoverageFrom: [
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
