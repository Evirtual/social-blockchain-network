export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error?: string };

export function ok<T>(value: T): ActionResult<T> {
  return { ok: true, value };
}

export function fail<T = void>(error?: string): ActionResult<T> {
  return { ok: false, error };
}
