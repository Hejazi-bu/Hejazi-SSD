module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parser: "@typescript-eslint/parser", // نبقي على المحلل اللغوي لـ TS
  plugins: [
    "@typescript-eslint", // نبقي على الملحق الأساسي لـ TS
  ],
  extends: [
    "eslint:recommended", // قاعدة أساسية فقط
    "plugin:@typescript-eslint/recommended", // قواعد TS أساسية
  ],
  ignorePatterns: [
    "/lib/**/*", // تجاهل الملفات المترجمة
    "/.eslintrc.js",
  ],
  rules: {
    // يمكن إضافة قواعد بسيطة هنا لاحقاً إذا احتجنا
     "quotes": ["warn", "double"], // تخفيف حدة الخطأ للتجربة
     "import/no-unresolved": "off" // تعطيل قاعدة الاستيراد مؤقتًا
  },
};