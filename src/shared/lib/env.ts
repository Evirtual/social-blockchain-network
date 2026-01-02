export type EnvMap = ImportMetaEnv & Record<string, string | boolean | undefined>;

export function getEnv(): EnvMap {
  return import.meta.env;
}

export function getEnvString(env: EnvMap, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" ? value : undefined;
}
