// Metro config for Axon mobile inside a pnpm monorepo.
//
// Two tweaks beyond the default:
//   1. Watch the whole workspace so changes in packages/shared trigger reloads.
//   2. Let Metro resolve modules from both the app's node_modules and the
//      monorepo root's node_modules (pnpm hoists some deps there).

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: "./global.css" });
