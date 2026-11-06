import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

const coreWebVitals = nextPlugin.configs["core-web-vitals"];

/** Flat config: TypeScript parsing + official Next.js plugin (no FlatCompat). */
const eslintConfig = tseslint.config(
  { ignores: [".next/**", "node_modules/**", ".playwright-cli/**", "recordings/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: coreWebVitals.plugins,
    rules: {
      ...coreWebVitals.rules,
      // False-positive prone with Server Actions / Server Components.
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);

export default eslintConfig;
