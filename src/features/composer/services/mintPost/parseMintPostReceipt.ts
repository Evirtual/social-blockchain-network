import { socialInterface } from "../../../contract";

export function parseMintPostReceipt(receipt: any): {
  mintedTokenId: string | null;
  mintedAuthor: string | undefined;
  mintTxHash: string | undefined;
  mintBlockNumber: number | undefined;
} {
  let mintedTokenId: string | null = null;
  let mintedAuthor: string | undefined;

  const mintTxHash = receipt?.hash;
  const mintBlockNumber = typeof receipt?.blockNumber === "number" ? Number(receipt.blockNumber) : undefined;

  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = socialInterface.parseLog({ topics: log.topics as string[], data: log.data });
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
