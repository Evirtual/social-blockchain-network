import { Link } from "react-router-dom";
import { useEffect } from "react";

import { ipfsToHttp } from "@features/ipfs";
import { stableHueFromSeed } from "@shared/lib/format";

import { Modal } from "@features/app/components/Modal";
import { useProfileActions, useProfileState } from "@features/profile";

export type AddressListModalProps = {
  open: boolean;
  title: string;
  addresses: string[];
  isLoading?: boolean;
  emptyText: string;
  onClose: () => void;
  shortAddress: (address: string) => string;
  headerLeading?: React.ReactNode;
};

export function AddressListModal(props: AddressListModalProps) {
  const profileState = useProfileState();
  const profileActions = useProfileActions();

  const loadingSkeletonRows = props.isLoading
    ? Array.from({ length: 1 }).map((_, idx) => (
        <div key={`addr-skeleton-${idx}`} className="listRow" aria-hidden="true">
          <span className="listRowLeft">
            <div className="avatar tiny skeleton" />
            <span className="value" style={{ display: "inline-flex", alignItems: "center" }}>
              <span className="skeletonLine" style={{ width: "7rem" }} />
            </span>
          </span>
          <span className="muted">
            <span className="skeletonLine" style={{ width: "5.5rem" }} />
          </span>
        </div>
      ))
    : null;

  useEffect(() => {
    if (!props.open) return;
    const addrs = props.addresses.slice(0, 24);
    if (addrs.length === 0) return;
    void Promise.all(addrs.map((a) => profileActions.loadProfile(a)));
  }, [profileActions, props.addresses, props.open]);

  return (
    <Modal open={props.open} title={props.title} headerLeading={props.headerLeading} onClose={props.onClose}>
      <div className="list">
        {loadingSkeletonRows}

        {!props.isLoading && props.addresses.length === 0 ? <div className="muted">{props.emptyText}</div> : null}

        {props.addresses.map((addr) => (
          <Link key={addr} className="listRow" to={`/profile/${addr}`} onClick={props.onClose}>
            <span className="listRowLeft">
              <div
                className="avatar tiny"
                style={(() => {
                  const key = addr.toLowerCase();
                  const p = profileState.profilesByAddress[key];
                  const av = p?.avatarUrl?.trim();
                  return av
                    ? { backgroundImage: `url(${ipfsToHttp(av)})` }
                    : { background: `hsl(${stableHueFromSeed(addr)} 75% 55%)` };
                })()}
              />
              <span className="value">{props.shortAddress(addr)}</span>
            </span>
            <span className="muted">Open profile</span>
          </Link>
        ))}
      </div>
    </Modal>
  );
}
