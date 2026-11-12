import baseConfig from "@hono/eslint-config";

export default [
  ...baseConfig,
  {
    ignores: ["**/*", "!src/", "!src/**", "!scripts/", "!scripts/**"],
  },
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module",
      },
    },
  },
];
