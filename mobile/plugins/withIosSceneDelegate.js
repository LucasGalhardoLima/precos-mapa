const { withAppDelegate } = require('@expo/config-plugins');

// iOS 27 requires apps to adopt the UIScene life cycle — without it the app doesn't
// launch (EXC_BREAKPOINT, "Application failed to launch: UIScene life cycle is
// required for apps built with this SDK"). Expo 57 ships the scene delegate class
// (EXExpoAppSceneDelegate) but its prebuild template doesn't wire it up yet, so this
// plugin does it by hand until an Expo SDK upgrade makes it redundant.
//
// The Info.plist half (UIApplicationSceneManifest) is declared directly via
// `ios.infoPlist` in app.json — only the AppDelegate.swift half needs code changes,
// which `infoPlist` merging can't express.
//
// Both edits are string replacements against the exact template Expo 57.0.x
// generates. If a future `expo prebuild` produces different AppDelegate.swift
// content, these silently no-op instead of throwing — check the window/
// startReactNative block is still gone and `ExpoReactNativeFactoryProvider` is
// still on the class after every `expo prebuild`.
module.exports = function withIosSceneDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('withIosSceneDelegate expects a Swift AppDelegate (got ' + config.modResults.language + ')');
    }

    let contents = config.modResults.contents;

    // Let EXExpoAppSceneDelegate find the React Native factory created below.
    // No-op (string already gone) if this already ran.
    contents = contents.replace(
      'class AppDelegate: ExpoAppDelegate {',
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
    );

    // The scene delegate now owns window creation + startReactNative; doing it here
    // too starts React Native twice. No-op if this already ran.
    contents = contents.replace(
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/,
      '\n'
    );

    config.modResults.contents = contents;
    return config;
  });
};
