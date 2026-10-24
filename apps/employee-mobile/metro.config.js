// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// three 0.180+ is ESM-only. Its CommonJS entry only calls process.emitWarning,
// which React Native does not implement, and @react-three/fiber's native build
// loads three with require(). Point every three import at the ES module build.
const threeEsm = path.join(path.dirname(require.resolve('three')), 'three.module.js');
const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { filePath: threeEsm, type: 'sourceFile' };
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
