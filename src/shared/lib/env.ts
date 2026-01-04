export type EnvMap = ImportMetaEnv & Record<string, string | boolean | undefined>;

export function getEnv(): EnvMap {
  return import.meta.env;
}

export function getEnvString(env: EnvMap, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" ? value : undefined;
}

export function getEnvBoolean(env: EnvMap, key: string, defaultValue = false): boolean {
  const raw = env[key];
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return defaultValue;
}
