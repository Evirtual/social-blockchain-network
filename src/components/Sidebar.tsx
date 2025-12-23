import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { ipfsToHttp } from "../ipfs";
import { Modal } from "./Modal";
import { useState } from "react";
import { useApp } from "../contexts/AppContext";
import { useEffect } from "react";

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
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState<boolean>(() => !isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  const profileLink = props.walletAddress ? `/profile/${props.walletAddress}` : null;
  const avatarDisplayUrl = props.profileAvatarUrl;

  const [isFollowersOpen, setIsFollowersOpen] = useState(false);
  const [isFollowingOpen, setIsFollowingOpen] = useState(false);

  useEffect(() => {
    if (!isFollowersOpen) return;
    const addrs = (props.followers ?? []).slice(0, 24);
    if (addrs.length === 0) return;
    void Promise.all(addrs.map((a) => app.loadProfile(a)));
  }, [app, isFollowersOpen, props.followers]);

  useEffect(() => {
    if (!isFollowingOpen) return;
    const addrs = (props.following ?? []).slice(0, 24);
    if (addrs.length === 0) return;
    void Promise.all(addrs.map((a) => app.loadProfile(a)));
  }, [app, isFollowingOpen, props.following]);

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
              {props.isLoadingFollowing ? "…" : `${props.following?.length ?? 0}`} following
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
              profileLink ? (
                <Link to={profileLink}>{props.shortAddress(props.walletAddress)}</Link>
              ) : (
                props.shortAddress(props.walletAddress)
              )
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
            <button className="secondary" type="button" onClick={props.onDisconnectWallet}>
              Disconnect
            </button>
          </div>
        ) : null}
      </div>

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
          {(props.followers ?? []).length === 0 ? (
            <div className="muted">No followers yet.</div>
          ) : (
            (props.followers ?? []).map((addr) => (
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
          {(props.following ?? []).length === 0 ? (
            <div className="muted">Not following anyone yet.</div>
          ) : (
            (props.following ?? []).map((addr) => (
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
