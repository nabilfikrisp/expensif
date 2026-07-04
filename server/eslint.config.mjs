import baseConfig from "@hono/eslint-config";

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
  },
];
