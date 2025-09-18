module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // تجاهل الملفات المترجمة
    "/.eslintrc.js", // أضف هذا السطر لتجاهل فحص هذا الملف
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "indent": "off",
    "max-len": "off",
    "camelcase": "off",
    "object-curly-spacing": "off",
    "arrow-parens": "off",
    "require-jsdoc": "off",
    "no-unused-vars": "warn",
    "eol-last": "off"
  },
};