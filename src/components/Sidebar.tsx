import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { ipfsToHttp } from "../ipfs";
import { Modal } from "./Modal";
import { useState } from "react";
import { useApp } from "../contexts/AppContext";
import { useEffect } from "react";
import { useContract } from "../contexts/ContractContext";
import { useContractTx } from "../contexts/useContractTx";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 32.5rem)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 32.5rem)");
    const onChange = () => setIsMobile(mq.matches);

    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    // eslint-disable-next-line deprecation/deprecation
    else mq.addListener(onChange);

    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
      // eslint-disable-next-line deprecation/deprecation
      else mq.removeListener(onChange);
    };
  }, []);

  return isMobile;
}

type Props = {
  walletAddress: string | null;
  displayName: string;
  profileBio: string;
  profileAvatarUrl: string;
  myPostsCount?: number;
  followerCount?: number;
  followers?: string[] | null;
  following?: string[] | null;
  isLoadingFollowers?: boolean;
  isLoadingFollowing?: boolean;
  onDisconnectWallet: () => void;
  isEditingProfile: boolean;
  profileDraftName: string;
  profileDraftBio: string;
  profileDraftAvatarUrl: string;
  profileDraftAvatarDataUrl: string;
  isProfileAvatarLoading: boolean;
  onProfileDraftNameChange: (value: string) => void;
  onProfileDraftBioChange: (value: string) => void;
  onProfileDraftAvatarUrlChange: (value: string) => void;
  onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
  onClearProfileAvatar: () => void;
  onStartEditProfile: () => void;
  onCancelEditProfile: () => void;
  onSaveProfile: () => void | Promise<void>;
  selfAvatarHue: number;

  chainId: string | null;
  networkName: string | null;
  nativeBalance: string;
  withdrawableTipsWei: bigint;
  contractAddress: string | undefined;
  contractDeployed: boolean | null;
  status: string;
  onRefreshWalletPanel: () => void;
  onWithdrawTips: () => void;

  shortAddress: (address: string) => string;
  getNativeSymbol: (chainId: string | null) => string;
};

type ProfileCardProps = Pick<
  Props,
  | "walletAddress"
  | "displayName"
  | "profileBio"
  | "profileAvatarUrl"
  | "myPostsCount"
  | "followerCount"
  | "followers"
  | "following"
  | "isLoadingFollowers"
  | "isLoadingFollowing"
  | "onDisconnectWallet"
  | "isEditingProfile"
  | "profileDraftName"
  | "profileDraftBio"
  | "profileDraftAvatarUrl"
  | "profileDraftAvatarDataUrl"
  | "isProfileAvatarLoading"
  | "onProfileDraftNameChange"
  | "onProfileDraftBioChange"
  | "onProfileDraftAvatarUrlChange"
  | "onSelectProfileAvatarFile"
  | "onClearProfileAvatar"
  | "onStartEditProfile"
  | "onCancelEditProfile"
  | "onSaveProfile"
  | "selfAvatarHue"
  | "shortAddress"
>;

export function ProfileCard(props: ProfileCardProps) {
  const app = useApp();
  const contract = useContract();
  const { runContractTx } = useContractTx();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState<boolean>(() => !isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  const profileLink = props.walletAddress ? `/profile/${props.walletAddress}` : null;
  const avatarDisplayUrl = props.profileAvatarUrl;

  const followers = props.followers ?? [];
  const following = props.following ?? [];

  const [isFollowersOpen, setIsFollowersOpen] = useState(false);
  const [isFollowingOpen, setIsFollowingOpen] = useState(false);

  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!props.walletAddress) {
      setOwnerAddress(null);
      return;
    }
    void (async () => {
      try {
        const readContract = await contract.getReadContract();
        const o = (await (readContract as any).owner()) as string;
        if (!cancelled) setOwnerAddress(o);
      } catch {
        if (!cancelled) setOwnerAddress(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contract, props.walletAddress]);

  const isOwner =
    !!props.walletAddress && !!ownerAddress && props.walletAddress.toLowerCase() === ownerAddress.toLowerCase();

  const PENDING_APPROVALS_KEY = "pendingPosterApprovals";
  function readPendingApprovals(): string[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(PENDING_APPROVALS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
    } catch {
      return [];
    }
  }

  function writePendingApprovals(next: string[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PENDING_APPROVALS_KEY, JSON.stringify(next));
  }

  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<string[]>(() => readPendingApprovals());
  const [pendingInput, setPendingInput] = useState("");
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [onChainRequests, setOnChainRequests] = useState<string[]>([]);
  const [posterAllowedByAddress, setPosterAllowedByAddress] = useState<Record<string, boolean>>({});
  const [posterDisapprovedEverByAddress, setPosterDisapprovedEverByAddress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isApprovalsOpen) return;
    setPendingApprovals(readPendingApprovals());
  }, [isApprovalsOpen]);

  useEffect(() => {
    if (!isApprovalsOpen) return;
    if (!isOwner) {
      setOnChainRequests([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const readContract = await contract.getReadContract();
        const runner: any = (readContract as any).runner;
        const provider: any = runner?.provider ?? runner;
        const latest = (await provider?.getBlockNumber?.()) ?? 0;
        const fromBlock = Math.max(0, Number(latest) - 200_000);

        const logs = (await (readContract as any).queryFilter(
          (readContract as any).filters.PosterApprovalRequested(),
          fromBlock,
          latest
        )) as any[];

        const uniq: string[] = [];
        const seen = new Set<string>();
        for (const l of logs) {
          const addr = (l?.args?.[0] as string | undefined) ?? "";
          if (!addr) continue;
          const key = addr.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          uniq.push(addr);
          if (uniq.length >= 50) break;
        }

        if (!cancelled) setOnChainRequests(uniq);
      } catch {
        if (!cancelled) setOnChainRequests([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contract, isApprovalsOpen, isOwner]);

  useEffect(() => {
    if (!isApprovalsOpen) return;
    if (!isOwner) return;

    const byKey = new Map<string, string>();
    for (const a of [...pendingApprovals, ...onChainRequests]) {
      const raw = (a ?? "").trim();
      if (!raw) continue;
      if (!ethers.isAddress(raw)) continue;
      const key = raw.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, raw);
    }

    const addrs = Array.from(byKey.values());
    if (addrs.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const readContract = await contract.getReadContract();
        const checks = await Promise.all(
          addrs.map(async (a) => {
            try {
              const allowed = (await (readContract as any).isPosterAllowed(a)) as boolean;
              const disapprovedEver = (await (readContract as any).wasPosterDisapproved(a)) as boolean;
              return { a, allowed, disapprovedEver };
            } catch {
              return { a, allowed: false, disapprovedEver: false };
            }
          })
        );

        if (cancelled) return;
        setPosterAllowedByAddress((prev) => {
          const next = { ...prev };
          for (const c of checks) next[c.a.toLowerCase()] = c.allowed;
          return next;
        });

        setPosterDisapprovedEverByAddress((prev) => {
          const next = { ...prev };
          for (const c of checks) next[c.a.toLowerCase()] = c.disapprovedEver;
          return next;
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contract, isApprovalsOpen, isOwner, pendingApprovals, onChainRequests]);

  function addPendingApproval(raw: string) {
    const addr = raw.trim();
    if (!ethers.isAddress(addr)) {
      setApprovalsError("Invalid address");
      return;
    }
    const nextLower = addr.toLowerCase();
    const existing = pendingApprovals.map((a) => a.toLowerCase());
    if (existing.includes(nextLower)) {
      setApprovalsError("Already in list");
      return;
    }
    const next = [addr, ...pendingApprovals];
    setApprovalsError(null);
    setPendingApprovals(next);
    writePendingApprovals(next);
    setPendingInput("");
  }

  async function approvePending(addr: string) {
    setApprovalsError(null);
    await runContractTx("Approve poster", async () => {
      const writeContract = await contract.getWriteContract();
      return (writeContract as any).setPosterAllowed(addr, true);
    });

    setPosterAllowedByAddress((prev) => ({ ...prev, [addr.toLowerCase()]: true }));
  }

  async function disapprovePending(addr: string) {
    setApprovalsError(null);
    await runContractTx("Disapprove poster", async () => {
      const writeContract = await contract.getWriteContract();
      return (writeContract as any).setPosterAllowed(addr, false);
    });

    setPosterAllowedByAddress((prev) => ({ ...prev, [addr.toLowerCase()]: false }));
    setPosterDisapprovedEverByAddress((prev) => ({ ...prev, [addr.toLowerCase()]: true }));
  }

  async function deleteAllAndBlock(addr: string) {
    const normalized = addr.trim();
    if (!ethers.isAddress(normalized)) {
      setApprovalsError("Invalid address");
      return;
    }

    setApprovalsError(null);

    try {
      await runContractTx("Block poster", async () => {
        const writeContract = await contract.getWriteContract();
        return (writeContract as any).setPosterAllowed(normalized, false);
      });
    } catch {
      return;
    }

    setPosterAllowedByAddress((prev) => ({ ...prev, [normalized.toLowerCase()]: false }));
    setPosterDisapprovedEverByAddress((prev) => ({ ...prev, [normalized.toLowerCase()]: true }));

    // Best-effort: clear profile and burn posts. If one step fails, the others can still proceed.
    try {
      await runContractTx("Clear profile", async () => {
        const writeContract = await contract.getWriteContract();
        return (writeContract as any).adminClearProfile(normalized);
      });
    } catch {
      // ignore
    }

    let tokenIds: bigint[] = [];
    try {
      const readContract = await contract.getReadContract();
      const runner: any = (readContract as any).runner;
      const provider: any = runner?.provider ?? runner;
      const latest = (await provider?.getBlockNumber?.()) ?? 0;

      const logs = (await (readContract as any).queryFilter(
        (readContract as any).filters.PostMinted(normalized),
        0,
        latest
      )) as any[];

      const uniq = new Set<string>();
      for (const l of logs) {
        const id = l?.args?.[1] as bigint | undefined;
        if (typeof id !== "bigint") continue;
        uniq.add(id.toString());
      }
      tokenIds = Array.from(uniq).map((s) => BigInt(s));
    } catch {
      setApprovalsError("Blocked user, but failed to load their posts for deletion.");
      tokenIds = [];
    }

    for (const tokenId of tokenIds) {
      try {
        await runContractTx(`Delete post #${tokenId.toString()}`, async () => {
          const writeContract = await contract.getWriteContract();
          return (writeContract as any).adminBurnPost(tokenId);
        });
      } catch {
        // continue
      }
    }
  }

  function removePending(addr: string) {
    const next = pendingApprovals.filter((a) => a.toLowerCase() !== addr.toLowerCase());
    setPendingApprovals(next);
    writePendingApprovals(next);
  }

  useEffect(() => {
    if (!isFollowersOpen) return;
    const addrs = followers.slice(0, 24);
    if (addrs.length === 0) return;
    void Promise.all(addrs.map((a) => app.loadProfile(a)));
  }, [app, followers, isFollowersOpen]);

  useEffect(() => {
    if (!isFollowingOpen) return;
    const addrs = following.slice(0, 24);
    if (addrs.length === 0) return;
    void Promise.all(addrs.map((a) => app.loadProfile(a)));
  }, [app, following, isFollowingOpen]);

  const avatarStyle = avatarDisplayUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(avatarDisplayUrl)})` }
    : { background: `hsl(${props.selfAvatarHue} 75% 55%)` };

  const showHeaderStats = !!props.walletAddress;
  const hasAnyHeaderPills =
    showHeaderStats &&
    (typeof props.myPostsCount === "number" ||
      typeof props.followerCount === "number" ||
      typeof props.following?.length === "number");

  return (
    <details
      className="card cardDropdown profileDropdown"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cardDropdownSummary">
        <span className="cardTitle">Profile</span>
        <span className="cardDropdownMeta">
          {props.walletAddress ? props.shortAddress(props.walletAddress) : "Disconnected"}
        </span>
      </summary>

      <div className="cardDropdownBody">
      <div className="cardHeader">
        <div className="cardTitle">Profile</div>
        {hasAnyHeaderPills ? (
          <div className="cardHeaderPills">
            {typeof props.myPostsCount === "number" ? <span className="pill">{props.myPostsCount} posts</span> : null}
            {typeof props.followerCount === "number" ? (
              <button
                type="button"
                className="pill pillButton"
                onClick={() => setIsFollowersOpen(true)}
                disabled={!!props.isLoadingFollowers}
                aria-label="View followers"
              >
                {props.followerCount} followers
              </button>
            ) : null}
            <button
              type="button"
              className="pill pillButton"
              onClick={() => setIsFollowingOpen(true)}
              disabled={!!props.isLoadingFollowing}
              aria-label="View following"
            >
              {props.isLoadingFollowing ? "…" : `${following.length}`} following
            </button>
          </div>
        ) : null}
      </div>

      <div className="profileHeader">
        <div className="avatar" style={avatarStyle} />
        <div className="profileMain">
          <div className="profileName">
            {profileLink ? <Link to={profileLink}>{props.displayName}</Link> : props.displayName}
          </div>
          <div className="profileMeta">
            {props.walletAddress ? (
              <Link to={profileLink!}>{props.shortAddress(props.walletAddress)}</Link>
            ) : (
              "Connect wallet to edit profile"
            )}
          </div>
        </div>

        {!props.isEditingProfile && props.walletAddress ? (
          <div className="profileActions">
            <button className="secondary" type="button" onClick={props.onStartEditProfile}>
              Edit profile
            </button>
            {isOwner ? (
              <button className="secondary" type="button" onClick={() => setIsApprovalsOpen(true)}>
                Approvals
              </button>
            ) : null}
            <button className="secondary" type="button" onClick={props.onDisconnectWallet}>
              Disconnect
            </button>
          </div>
        ) : null}
      </div>

      <Modal open={isApprovalsOpen} title="Approvals" onClose={() => setIsApprovalsOpen(false)}>
        <div className="composer">
          <div className="muted">Approve wallets that are allowed to mint posts during testing.</div>

          <div className="row">
            <input
              className="input"
              value={pendingInput}
              onChange={(e) => setPendingInput(e.target.value)}
              placeholder="0x... wallet address"
            />
            <button className="secondary" type="button" onClick={() => addPendingApproval(pendingInput)}>
              Add
            </button>
          </div>

          {approvalsError ? <div className="muted">{approvalsError}</div> : null}

          <div className="list">
            {pendingApprovals.length === 0 ? null : (
              pendingApprovals.map((addr) => (
                <div key={addr} className="listRow" role="listitem">
                  <span className="listRowLeft">
                    <span className="value">{props.shortAddress(addr)}</span>
                    {posterDisapprovedEverByAddress[addr.toLowerCase()] ? <span className="pill">Flagged</span> : null}
                  </span>
                  <span className="rowActions">
                    <button className="secondary" type="button" onClick={() => removePending(addr)}>
                      Remove
                    </button>
                    {posterAllowedByAddress[addr.toLowerCase()] ? null : (
                      <button className="primary" type="button" onClick={() => void approvePending(addr)}>
                        Approve
                      </button>
                    )}
                    {posterAllowedByAddress[addr.toLowerCase()] ? (
                      <button className="secondary" type="button" onClick={() => void disapprovePending(addr)}>
                        Disapprove
                      </button>
                    ) : null}
                    <button className="secondary" type="button" onClick={() => void deleteAllAndBlock(addr)}>
                      Delete all
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          {onChainRequests.length ? (
            <>
              <div className="muted">
                Requests from chain
              </div>
              <div className="list">
                {onChainRequests.map((addr) => (
                  <div key={addr} className="listRow" role="listitem">
                    <span className="listRowLeft">
                      <span className="value">{props.shortAddress(addr)}</span>
                      {posterDisapprovedEverByAddress[addr.toLowerCase()] ? <span className="pill">Flagged</span> : null}
                    </span>
                    <span className="rowActions">
                      {posterAllowedByAddress[addr.toLowerCase()] ? null : (
                        <button className="primary" type="button" onClick={() => void approvePending(addr)}>
                          Approve
                        </button>
                      )}
                      {posterAllowedByAddress[addr.toLowerCase()] ? (
                        <button className="secondary" type="button" onClick={() => void disapprovePending(addr)}>
                          Disapprove
                        </button>
                      ) : null}
                      <button className="secondary" type="button" onClick={() => void deleteAllAndBlock(addr)}>
                        Delete all
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal open={props.isEditingProfile} title="Edit profile" onClose={props.onCancelEditProfile}>
        <div className="composer">
          <input
            className="input"
            value={props.profileDraftName}
            onChange={(e) => props.onProfileDraftNameChange(e.target.value)}
            placeholder="Display name"
          />
          <textarea
            className="textarea"
            rows={3}
            value={props.profileDraftBio}
            onChange={(e) => props.onProfileDraftBioChange(e.target.value)}
            placeholder="Bio"
          />

          <input
            className="input"
            value={props.profileDraftAvatarUrl}
            onChange={(e) => props.onProfileDraftAvatarUrlChange(e.target.value)}
            placeholder="Avatar image URL (or upload below)"
          />

          <div className="row fileRow">
            <input
              className="file-input"
              type="file"
              accept="image/*"
              onChange={(event) => props.onSelectProfileAvatarFile(event.target.files?.[0] ?? null)}
            />
            <button type="button" className="secondary" onClick={props.onClearProfileAvatar}>
              Clear
            </button>
          </div>

          {props.profileDraftAvatarDataUrl.startsWith("data:image/") && (
            <img className="image-preview" src={props.profileDraftAvatarDataUrl} alt="Avatar preview" />
          )}

          <div className="rowActions">
            <button className="secondary" type="button" onClick={props.onCancelEditProfile}>
              Cancel
            </button>
            <button
              className="primary"
              type="button"
              onClick={props.onSaveProfile}
              disabled={props.isProfileAvatarLoading}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={isFollowersOpen} title="Followers" onClose={() => setIsFollowersOpen(false)}>
        <div className="list">
          {followers.length === 0 ? (
            <div className="muted">No followers yet.</div>
          ) : (
            followers.map((addr) => (
              <Link key={addr} className="listRow" to={`/profile/${addr}`} onClick={() => setIsFollowersOpen(false)}>
                <span className="listRowLeft">
                  <div
                    className="avatar tiny"
                    style={(() => {
                      const key = addr.toLowerCase();
                      const p = app.profilesByAddress[key];
                      const av = p?.avatarUrl?.trim();
                      return av
                        ? { backgroundImage: `url(${ipfsToHttp(av)})` }
                        : { background: `hsl(${app.stableHueFromSeed(addr)} 75% 55%)` };
                    })()}
                  />
                  <span className="value">{props.shortAddress(addr)}</span>
                </span>
                <span className="muted">Open profile</span>
              </Link>
            ))
          )}
        </div>
      </Modal>

      <Modal open={isFollowingOpen} title="Following" onClose={() => setIsFollowingOpen(false)}>
        <div className="list">
          {following.length === 0 ? (
            <div className="muted">Not following anyone yet.</div>
          ) : (
            following.map((addr) => (
              <Link key={addr} className="listRow" to={`/profile/${addr}`} onClick={() => setIsFollowingOpen(false)}>
                <span className="listRowLeft">
                  <div
                    className="avatar tiny"
                    style={(() => {
                      const key = addr.toLowerCase();
                      const p = app.profilesByAddress[key];
                      const av = p?.avatarUrl?.trim();
                      return av
                        ? { backgroundImage: `url(${ipfsToHttp(av)})` }
                        : { background: `hsl(${app.stableHueFromSeed(addr)} 75% 55%)` };
                    })()}
                  />
                  <span className="value">{props.shortAddress(addr)}</span>
                </span>
                <span className="muted">Open profile</span>
              </Link>
            ))
          )}
        </div>
      </Modal>

      {props.walletAddress && (
        <div className="profileBio">
          <div className="muted">{props.profileBio || "Add a short bio to personalize your profile."}</div>
        </div>
      )}
      </div>
    </details>
  );
}

type WalletCardProps = Pick<
  Props,
  | "walletAddress"
  | "chainId"
  | "networkName"
  | "nativeBalance"
  | "withdrawableTipsWei"
  | "contractAddress"
  | "contractDeployed"
  | "status"
  | "onRefreshWalletPanel"
  | "onWithdrawTips"
  | "shortAddress"
  | "getNativeSymbol"
>;

export function WalletCard(props: WalletCardProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState<boolean>(() => !isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  return (
    <details
      className="card cardDropdown walletDropdown"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cardDropdownSummary">
        <span className="cardTitle">Wallet</span>
        <span className="cardDropdownMeta">
          {props.walletAddress ? props.shortAddress(props.walletAddress) : "Disconnected"}
        </span>
      </summary>

      <div className="cardDropdownBody">
        <div className="cardHeader">
          <div className="cardTitle">Wallet</div>
        </div>

        <div className="walletRows">
        <div className="walletRow">
          <div className="walletField">
            <div className="label">Address</div>
            <div className="value">{props.walletAddress ? props.shortAddress(props.walletAddress) : "—"}</div>
          </div>
          <div className="walletField">
            <div className="label">Network</div>
            <div className="value">
              {props.networkName ? `${props.networkName} (${props.chainId})` : props.chainId ? props.chainId : "—"}
            </div>
          </div>
        </div>

        <div className="walletRow">
          <div className="walletField">
            <div className="label">Balance</div>
            <div className="value">
              {props.nativeBalance} {props.getNativeSymbol(props.chainId)}
            </div>
          </div>
          <div className="walletField">
            <div className="label">Tips</div>
            <div className="value">
              {props.withdrawableTipsWei > 0n
                ? `${Number(ethers.formatEther(props.withdrawableTipsWei)).toFixed(4)} ${props.getNativeSymbol(
                    props.chainId
                  )}`
                : "0"}
            </div>
          </div>
        </div>

        <div className="walletRow walletContractRow">
          <div className="walletField">
            <div className="label">Contract</div>
            <div className="value">
              {props.contractAddress ? props.shortAddress(String(props.contractAddress)) : "—"}
              {props.contractDeployed === false ? " (not on this chain)" : ""}
            </div>
          </div>

          <div className="walletContractActions">
            <button
              className="secondary"
              type="button"
              onClick={props.onRefreshWalletPanel}
              disabled={!props.walletAddress}
            >
              Refresh
            </button>
            <button
              className="secondary"
              type="button"
              onClick={props.onWithdrawTips}
              disabled={!props.walletAddress || props.withdrawableTipsWei === 0n}
            >
              Withdraw tips
            </button>
          </div>
        </div>
        </div>
      </div>
    </details>
  );
}

export function Sidebar({
  walletAddress,
  displayName,
  profileBio,
  profileAvatarUrl,
  myPostsCount,
  followerCount,
  followers,
  following,
  isLoadingFollowers,
  isLoadingFollowing,
  onDisconnectWallet,
  isEditingProfile,
  profileDraftName,
  profileDraftBio,
  profileDraftAvatarUrl,
  profileDraftAvatarDataUrl,
  isProfileAvatarLoading,
  onProfileDraftNameChange,
  onProfileDraftBioChange,
  onProfileDraftAvatarUrlChange,
  onSelectProfileAvatarFile,
  onClearProfileAvatar,
  onStartEditProfile,
  onCancelEditProfile,
  onSaveProfile,
  selfAvatarHue,
  chainId,
  networkName,
  nativeBalance,
  withdrawableTipsWei,
  contractAddress,
  contractDeployed,
  status,
  onRefreshWalletPanel,
  onWithdrawTips,
  shortAddress,
  getNativeSymbol
}: Props) {
  return (
    <aside className="sidebar">
      <ProfileCard
        walletAddress={walletAddress}
        displayName={displayName}
        profileBio={profileBio}
        profileAvatarUrl={profileAvatarUrl}
        myPostsCount={myPostsCount}
        followerCount={followerCount}
        followers={followers}
        following={following}
        isLoadingFollowers={isLoadingFollowers}
        isLoadingFollowing={isLoadingFollowing}
        onDisconnectWallet={onDisconnectWallet}
        isEditingProfile={isEditingProfile}
        profileDraftName={profileDraftName}
        profileDraftBio={profileDraftBio}
        profileDraftAvatarUrl={profileDraftAvatarUrl}
        profileDraftAvatarDataUrl={profileDraftAvatarDataUrl}
        isProfileAvatarLoading={isProfileAvatarLoading}
        onProfileDraftNameChange={onProfileDraftNameChange}
        onProfileDraftBioChange={onProfileDraftBioChange}
        onProfileDraftAvatarUrlChange={onProfileDraftAvatarUrlChange}
        onSelectProfileAvatarFile={onSelectProfileAvatarFile}
        onClearProfileAvatar={onClearProfileAvatar}
        onStartEditProfile={onStartEditProfile}
        onCancelEditProfile={onCancelEditProfile}
        onSaveProfile={onSaveProfile}
        selfAvatarHue={selfAvatarHue}
        shortAddress={shortAddress}
      />

      <WalletCard
        walletAddress={walletAddress}
        chainId={chainId}
        networkName={networkName}
        nativeBalance={nativeBalance}
        withdrawableTipsWei={withdrawableTipsWei}
        contractAddress={contractAddress}
        contractDeployed={contractDeployed}
        status={status}
        onRefreshWalletPanel={onRefreshWalletPanel}
        onWithdrawTips={onWithdrawTips}
        shortAddress={shortAddress}
        getNativeSymbol={getNativeSymbol}
      />
    </aside>
  );
}
