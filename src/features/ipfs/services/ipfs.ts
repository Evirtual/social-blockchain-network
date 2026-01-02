export type PinataPinResponse = {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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

export const hasPinata = () => Boolean(import.meta.env.VITE_PINATA_JWT);

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
  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error(
      "Missing VITE_PINATA_JWT (Pinata). Note: do not ship a Pinata JWT in client-side env vars for production; use a backend/serverless pinning endpoint instead."
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

export const pinataPinFile = async (file: Blob, filename: string) => {
  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error(
      "Missing VITE_PINATA_JWT (Pinata). Note: do not ship a Pinata JWT in client-side env vars for production; use a backend/serverless pinning endpoint instead."
    );
  }

  const form = new FormData();
  form.append("file", file, filename);

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

export const pinataPinJson = async (json: JsonValue) => {
  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error(
      "Missing VITE_PINATA_JWT (Pinata). Note: do not ship a Pinata JWT in client-side env vars for production; use a backend/serverless pinning endpoint instead."
    );
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(json)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata metadata upload failed (${res.status}). ${text}`);
  }

  return (await res.json()) as PinataPinResponse;
};
