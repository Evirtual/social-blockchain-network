export type PinataPinResponse = {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function uniqueSuffix(): string {
  // Ensure uniqueness even for identical files uploaded repeatedly.
  try {
    if (typeof crypto !== "undefined") {
      if ("randomUUID" in crypto) {
        // Keep suffix compact; Pinata table truncates long names.
        return (crypto as Crypto).randomUUID().slice(0, 8);
      }
      if ("getRandomValues" in crypto) {
        const buf = new Uint32Array(1);
        (crypto as Crypto).getRandomValues(buf);
        return buf[0].toString(16).padStart(8, "0");
      }
    }
  } catch {
    // ignore
  }

  // Fallback: short base36 timestamp + random chars.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function sanitizeName(raw: string): string {
  return String(raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function shortHex(addr: string, lead = 6, tail = 4): string {
  const a = String(addr ?? "").trim();
  if (!a) return "";
  const lower = a.toLowerCase();
  if (!lower.startsWith("0x") || lower.length < 2 + lead + tail) return a;
  return `${lower.slice(0, 2 + lead)}…${lower.slice(-tail)}`;
}

export type PinataNameContext =
  | {
      kind: "post";
      purpose: "media" | "metadata";
      chainId?: string | number | null;
      author?: string | null;
      tokenId?: string | number | bigint | null;
      title?: string | null;
    }
  | {
      kind: "profile";
      purpose: "avatar";
      chainId?: string | number | null;
      account?: string | null;
    };

export function makePinataBaseName(ctx: PinataNameContext): string {
  const parts: string[] = [];
  const truncate = (raw: string, max = 28) => {
    const s = sanitizeName(raw);
    if (!s) return "";
    return s.length > max ? s.slice(0, max).trimEnd() : s;
  };

  if (ctx.kind === "post") {
    const tokenId = ctx.tokenId != null && String(ctx.tokenId).trim() ? String(ctx.tokenId).trim() : "pending";
    // Put the most important bits first so truncated UIs still show them.
    parts.push(`post-${tokenId}`);
    parts.push(ctx.purpose);
    if (ctx.chainId != null && String(ctx.chainId).trim()) parts.push(`chain-${String(ctx.chainId).trim()}`);
    if (ctx.author) parts.push(`by-${shortHex(ctx.author)}`);
    if (ctx.title) {
      const t = truncate(ctx.title);
      if (t) parts.push(t);
    }
  } else {
    parts.push("profile-avatar");
    if (ctx.chainId != null && String(ctx.chainId).trim()) parts.push(`chain-${String(ctx.chainId).trim()}`);
    if (ctx.account) parts.push(shortHex(ctx.account));
  }

  // Pinata names are shown in UI; keep them readable and compact.
  const base = sanitizeName(parts.filter(Boolean).join(" "));
  return base || "upload";
}

export function makeUniquePinName(base: string, maxLen = 120): string {
  const cleaned = sanitizeName(base) || "upload";
  const suffix = uniqueSuffix();
  const candidate = `${cleaned}-${suffix}`;
  return candidate.length > maxLen ? candidate.slice(0, maxLen) : candidate;
}

function guessExtensionFromMime(mime?: string): string {
  const m = String(mime ?? "").toLowerCase().trim();
  if (!m) return "";
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/gif") return "gif";
  if (m === "image/webp") return "webp";
  if (m === "image/avif") return "avif";
  if (m === "video/mp4") return "mp4";
  if (m === "video/webm") return "webm";
  if (m === "video/quicktime") return "mov";
  return "";
}

export function makeUniqueFilename(filename: string, mime?: string): string {
  const raw = String(filename ?? "").trim() || "upload";
  const lastDot = raw.lastIndexOf(".");
  const hasExt = lastDot > 0 && lastDot < raw.length - 1;

  const base = hasExt ? raw.slice(0, lastDot) : raw;
  const ext = hasExt ? raw.slice(lastDot + 1) : guessExtensionFromMime(mime);

  const uniqueBase = makeUniquePinName(base, 180);
  const safeBase = sanitizeName(uniqueBase)
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();

  const safeExt = sanitizeName(ext)
    .replace(/[^a-zA-Z0-9]+/g, "")
    .trim();

  const finalBase = safeBase || "upload";
  return safeExt ? `${finalBase}.${safeExt.toLowerCase()}` : finalBase;
}

export function makeUploadNonce(): string {
  return uniqueSuffix();
}

const DEFAULT_IPFS_GATEWAY_BASES = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/"
];

function normalizeGatewayBase(raw: string): string {
  let base = String(raw ?? "").trim();
  if (!base) return "";
  if (!base.endsWith("/")) base = `${base}/`;

  // Accept either a full ".../ipfs/" base or a site root (".../").
  // If it's a site root, append "/ipfs/" so concatenation works.
  const lower = base.toLowerCase();
  if (!lower.includes("/ipfs/")) base = `${base}ipfs/`;
  return base;
}

export const getIpfsGatewayBases = () => {
  const list = import.meta.env.VITE_IPFS_GATEWAYS as string | undefined;
  const single = import.meta.env.VITE_IPFS_GATEWAY as string | undefined;

  const bases = list
    ? list
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : single
      ? [single]
      : DEFAULT_IPFS_GATEWAY_BASES;

  const uniq = new Set<string>();
  for (const b of bases) {
    const normalized = normalizeGatewayBase(b);
    if (normalized) uniq.add(normalized);
  }
  return Array.from(uniq);
};

export const getIpfsGatewayBase = () => {
  // Default to Pinata public gateway for better large-media reliability.
  // Can be overridden via VITE_IPFS_GATEWAY.
  return getIpfsGatewayBases()[0] ?? normalizeGatewayBase("https://gateway.pinata.cloud/ipfs/");
};

export const ipfsToHttpWithGateway = (uri: string, gatewayBase: string) => {
  const base = gatewayBase.endsWith("/") ? gatewayBase : `${gatewayBase}/`;
  if (uri.startsWith("ipfs://")) {
    let path = uri.replace("ipfs://", "");
    // Common variants: ipfs://<CID> and ipfs://ipfs/<CID>
    if (path.startsWith("ipfs/")) path = path.slice("ipfs/".length);
    return `${base}${path}`;
  }
  return uri;
};

export const ipfsToHttp = (uri: string) => {
  return ipfsToHttpWithGateway(uri, getIpfsGatewayBase());
};

export const ipfsToHttpCandidates = (uri: string, gatewayBases?: string[]) => {
  if (!String(uri ?? "").startsWith("ipfs://")) return [uri];
  const bases = gatewayBases && gatewayBases.length > 0 ? gatewayBases : getIpfsGatewayBases();
  return bases.map((base) => ipfsToHttpWithGateway(uri, base));
};

const getPinataWorkerUrl = (): string => {
  const raw = import.meta.env.VITE_PINATA_WORKER_URL as string | undefined;
  const trimmed = String(raw ?? "").trim();
  return trimmed.replace(/\/+$/, "");
};

export const hasPinata = () => Boolean(getPinataWorkerUrl() || import.meta.env.VITE_PINATA_JWT);

export const extractIpfsCid = (uri: string): string | null => {
  const raw = String(uri ?? "").trim();
  if (!raw) return null;

  // ipfs://<CID> or ipfs://ipfs/<CID>
  if (raw.startsWith("ipfs://")) {
    let rest = raw.slice("ipfs://".length);
    if (rest.startsWith("ipfs/")) rest = rest.slice("ipfs/".length);
    const cid = rest.split("/")[0]?.trim();
    return cid ? cid : null;
  }

  // Common gateway form: https://.../ipfs/<CID>/...
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);
    const ipfsIndex = parts.findIndex((p) => p === "ipfs");
    if (ipfsIndex >= 0 && parts[ipfsIndex + 1]) {
      const cid = String(parts[ipfsIndex + 1]).trim();
      return cid ? cid : null;
    }
  } catch {
    // ignore
  }

  return null;
};

export const pinataUnpinCid = async (cid: string) => {
  const workerUrl = getPinataWorkerUrl();
  if (workerUrl) {
    const hash = String(cid ?? "").trim();
    if (!hash) return;
    const res = await fetch(`${workerUrl}/pin/${hash}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      throw new Error(`Pinata unpin failed (${res.status}). ${text}`);
    }
    return;
  }

  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error(
      "Missing Pinata credentials. Configure VITE_PINATA_WORKER_URL (recommended) or VITE_PINATA_JWT for local dev."
    );
  }

  const hash = String(cid ?? "").trim();
  if (!hash) return;

  const res = await fetch(`https://api.pinata.cloud/pinning/unpin/${hash}` as string, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`
    }
  });

  // If the CID isn't pinned in this account, Pinata can return 404.
  // Treat unpin as best-effort cleanup.
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata unpin failed (${res.status}). ${text}`);
  }
};

export const pinataPinFile = async (
  file: Blob,
  filename: string,
  name?: string,
  options?: { wrapWithDirectory?: boolean }
) => {
  const workerUrl = getPinataWorkerUrl();
  if (workerUrl) {
    const form = new FormData();
    form.append("file", file, filename);
    const trimmedName = String(name ?? "").trim();
    if (trimmedName) form.append("pinataMetadata", JSON.stringify({ name: trimmedName }));
    if (options?.wrapWithDirectory) form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: true }));
    const res = await fetch(`${workerUrl}/pin/file`, { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Pinata file upload failed (${res.status}). ${text}`);
    }
    return (await res.json()) as PinataPinResponse;
  }

  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error(
      "Missing Pinata credentials. Configure VITE_PINATA_WORKER_URL (recommended) or VITE_PINATA_JWT for local dev."
    );
  }

  const form = new FormData();
  form.append("file", file, filename);
  const trimmedName = String(name ?? "").trim();
  if (trimmedName) form.append("pinataMetadata", JSON.stringify({ name: trimmedName }));
  if (options?.wrapWithDirectory) form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: true }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`
    },
    body: form
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata file upload failed (${res.status}). ${text}`);
  }

  return (await res.json()) as PinataPinResponse;
};

export const pinataPinJson = async (json: JsonValue, name?: string) => {
  const workerUrl = getPinataWorkerUrl();
  const trimmedName = String(name ?? "").trim();
  const payload = trimmedName
    ? {
        pinataMetadata: { name: trimmedName },
        pinataContent: json
      }
    : json;
  if (workerUrl) {
    const res = await fetch(`${workerUrl}/pin/json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Pinata metadata upload failed (${res.status}). ${text}`);
    }
    return (await res.json()) as PinataPinResponse;
  }

  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error(
      "Missing Pinata credentials. Configure VITE_PINATA_WORKER_URL (recommended) or VITE_PINATA_JWT for local dev."
    );
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata metadata upload failed (${res.status}). ${text}`);
  }

  return (await res.json()) as PinataPinResponse;
};
