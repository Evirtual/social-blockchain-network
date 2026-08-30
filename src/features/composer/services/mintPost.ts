import { socialInterface } from "@features/contract/contracts/socialPosts";
import type { Log, TransactionReceipt } from "ethers";

export { waitForMetadataReady } from "@features/metadata";

export function parseMintPostReceipt(receipt: TransactionReceipt): {
  mintedTokenId: string | null;
  mintedAuthor: string | undefined;
  mintTxHash: string | undefined;
  mintBlockNumber: number | undefined;
} {
  let mintedTokenId: string | null = null;
  let mintedAuthor: string | undefined;

  const mintTxHash = receipt.hash;
  const mintBlockNumber = typeof receipt.blockNumber === "number" ? Number(receipt.blockNumber) : undefined;

  for (const log of receipt.logs ?? ([] as Log[])) {
    try {
      const parsed = socialInterface.parseLog(log);
      if (parsed?.name === "PostMinted") {
        mintedAuthor = parsed.args[0] as string;
        mintedTokenId = (parsed.args[1] as bigint).toString();
        break;
      }
    } catch {
      // not our event
    }
  }

  return { mintedTokenId, mintedAuthor, mintTxHash, mintBlockNumber };
}
