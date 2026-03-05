const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Monorepo: resolve packages/shared from the workspace root
const workspaceRoot = path.resolve(__dirname, "..");
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force all code to use mobile's copies of these packages (prevent duplicates
// from root node_modules when packages/shared resolves through the monorepo)
const forceMobileResolution = ["react", "react-native", "zustand"];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (forceMobileResolution.includes(moduleName)) {
    return {
      filePath: require.resolve(moduleName, {
        paths: [path.resolve(__dirname, "node_modules")],
      }),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
