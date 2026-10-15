// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*"] },
  {
    rules: {
      // React Compiler advisories. The compiler is not enabled in this app; Reanimated's
      // `shared.value = …` inside press handlers and the "seed state from a loaded row"
      // effects are intentional. Kept visible as warnings, not failures.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);
