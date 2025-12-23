export type PinataPinResponse = {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
};

export const getIpfsGatewayBase = () => {
  // Default to Pinata public gateway for better large-media reliability.
  // Can be overridden via VITE_IPFS_GATEWAY.
  const gw =
    (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? "https://gateway.pinata.cloud/ipfs/";
  return gw.endsWith("/") ? gw : `${gw}/`;
};

export const ipfsToHttp = (uri: string) => {
  if (uri.startsWith("ipfs://")) {
    let path = uri.replace("ipfs://", "");
    // Common variants: ipfs://<CID> and ipfs://ipfs/<CID>
    if (path.startsWith("ipfs/")) path = path.slice("ipfs/".length);
    return `${getIpfsGatewayBase()}${path}`;
  }
  return uri;
};

export const hasPinata = () => Boolean(import.meta.env.VITE_PINATA_JWT);

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

export const pinataPinJson = async (json: unknown) => {
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
