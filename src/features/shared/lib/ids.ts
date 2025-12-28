export function makeLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeLocalNoticeId() {
  return makeLocalId("local");
}
