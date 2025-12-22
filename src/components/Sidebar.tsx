import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { ipfsToHttp } from "../ipfs";
import { Modal } from "./Modal";

type Props = {
  walletAddress: string | null;
  displayName: string;
  profileBio: string;
  profileAvatarUrl: string;
  myPostsCount?: number;
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
  const profileLink = props.walletAddress ? `/profile/${props.walletAddress}` : null;
  const avatarDisplayUrl = props.profileAvatarUrl;

  const avatarStyle = avatarDisplayUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(avatarDisplayUrl)})` }
    : { background: `hsl(${props.selfAvatarHue} 75% 55%)` };

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="cardTitle">Profile</div>
        {typeof props.myPostsCount === "number" && props.walletAddress ? (
          <span className="pill">{props.myPostsCount} posts</span>
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

      {props.walletAddress && (
        <div className="profileBio">
          <div className="muted">{props.profileBio || "Add a short bio to personalize your profile."}</div>
        </div>
      )}
    </div>
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
  return (
    <div className="card">
      <div className="cardHeader">
        <div className="cardTitle">Wallet</div>
      </div>
      <div className="walletGrid">
        <div>
          <div className="label">Address</div>
          <div className="value">{props.walletAddress ? props.shortAddress(props.walletAddress) : "—"}</div>
        </div>
        <div>
          <div className="label">Network</div>
          <div className="value">
            {props.networkName ? `${props.networkName} (${props.chainId})` : props.chainId ? props.chainId : "—"}
          </div>
        </div>
        <div>
          <div className="label">Balance</div>
          <div className="value">
            {props.nativeBalance} {props.getNativeSymbol(props.chainId)}
          </div>
        </div>
        <div>
          <div className="label">Tips</div>
          <div className="value">
            {props.withdrawableTipsWei > 0n
              ? `${Number(ethers.formatEther(props.withdrawableTipsWei)).toFixed(6)} ${props.getNativeSymbol(
                  props.chainId
                )}`
              : "0"}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div className="label">Contract</div>
          <div className="value">
            {props.contractAddress ? props.shortAddress(String(props.contractAddress)) : "—"}
            {props.contractDeployed === false ? " (not on this chain)" : ""}
          </div>
        </div>
      </div>
      <div className="rowActions">
        <button className="secondary" type="button" onClick={props.onRefreshWalletPanel} disabled={!props.walletAddress}>
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
  );
}

export function Sidebar({
  walletAddress,
  displayName,
  profileBio,
  profileAvatarUrl,
  myPostsCount,
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
