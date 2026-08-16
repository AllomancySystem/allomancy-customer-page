/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the AS.ThirdPartyApi host the customer page calls. */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
