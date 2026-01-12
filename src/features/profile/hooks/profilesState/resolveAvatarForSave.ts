import { makeUniqueFilename, makeUniquePinName, pinataPinFile } from "@features/ipfs";

export async function resolveAvatarForSave(params: {
  ipfsConfigured: boolean;
  uploadedAvatarBlob: Blob;
  uploadedAvatarFilename: string;
  draftAvatarDataUrl: string;
}): Promise<string> {
  const { ipfsConfigured, uploadedAvatarBlob, uploadedAvatarFilename, draftAvatarDataUrl } = params;

  if (ipfsConfigured) {
    const uniqueName = makeUniquePinName("profile-avatar");
    const uniqueFilename = makeUniqueFilename(uploadedAvatarFilename || "avatar", uploadedAvatarBlob.type);
    const pinned = await pinataPinFile(uploadedAvatarBlob, uniqueFilename, uniqueName);
    return `ipfs://${pinned.IpfsHash}`;
  }

  return draftAvatarDataUrl || "";
}
