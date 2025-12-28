import { pinataPinFile } from "../../../ipfs";

export async function resolveAvatarForSave(params: {
  ipfsConfigured: boolean;
  uploadedAvatarBlob: Blob;
  uploadedAvatarFilename: string;
  draftAvatarDataUrl: string;
}): Promise<string> {
  const { ipfsConfigured, uploadedAvatarBlob, uploadedAvatarFilename, draftAvatarDataUrl } = params;

  if (ipfsConfigured) {
    const pinned = await pinataPinFile(uploadedAvatarBlob, uploadedAvatarFilename);
    return `ipfs://${pinned.IpfsHash}`;
  }

  return draftAvatarDataUrl || "";
}
