import { makePinataBaseName, makeUniqueFilename, makeUniquePinName, pinataPinFile } from "@features/ipfs";

export async function resolveAvatarForSave(params: {
  ipfsConfigured: boolean;
  account?: string | null;
  chainId?: string | null;
  uploadedAvatarBlob: Blob;
  uploadedAvatarFilename: string;
  draftAvatarDataUrl: string;
}): Promise<string> {
  const { ipfsConfigured, account, chainId, uploadedAvatarBlob, uploadedAvatarFilename, draftAvatarDataUrl } = params;

  if (ipfsConfigured) {
    const base =
      makePinataBaseName({ kind: "profile", purpose: "avatar", account: account ?? undefined, chainId }) ||
      (uploadedAvatarFilename ? String(uploadedAvatarFilename).trim() : "profile-avatar");
    const uniqueName = makeUniquePinName(base);
    const uniqueFilename = makeUniqueFilename(base, uploadedAvatarBlob.type);
    const pinned = await pinataPinFile(uploadedAvatarBlob, uniqueFilename, uniqueName, { wrapWithDirectory: true });
    return `ipfs://${pinned.IpfsHash}/${uniqueFilename}`;
  }

  return draftAvatarDataUrl || "";
}
