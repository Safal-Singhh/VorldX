// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // react-three-fiber renders three.js objects through JSX intrinsics such as
    // <mesh>, <icosahedronGeometry> and the `attach` prop. These are valid in R3F
    // but unknown to the DOM-oriented lint rule.
    files: ['src/components/orb/Orb.native.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
]);
