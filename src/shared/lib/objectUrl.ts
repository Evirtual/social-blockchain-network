export function replaceObjectUrlRef(ref: { current: string | null }, value: Blob | MediaSource | null | undefined) {
  if (ref.current) {
    URL.revokeObjectURL(ref.current);
    ref.current = null;
  }
  if (!value) return "";
  const url = URL.createObjectURL(value);
  ref.current = url;
  return url;
}

export function clearObjectUrlRef(ref: { current: string | null }) {
  if (ref.current) {
    URL.revokeObjectURL(ref.current);
    ref.current = null;
  }
}

