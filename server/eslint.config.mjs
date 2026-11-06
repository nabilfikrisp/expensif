import baseConfig from "@hono/eslint-config";

export default [
  ...baseConfig,
  {
    ignores: ["drizzle.config.ts"],
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
