interface ImportMetaEnv {
  readonly VITE_DB_USER: string;
  readonly VITE_DB_HOST: string;
  readonly VITE_DB_NAME: string;
  readonly VITE_DB_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}