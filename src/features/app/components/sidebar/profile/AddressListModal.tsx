import { Link } from "react-router-dom";
import { useEffect } from "react";

import { ipfsToHttp } from "@features/ipfs";
import { stableHueFromSeed } from "@shared/lib/format";

import { Modal } from "../../Modal";
import { useProfile } from "../../../providers/ProfileContext";

export type AddressListModalProps = {
  open: boolean;
  title: string;
  addresses: string[];
  isLoading?: boolean;
  emptyText: string;
  onClose: () => void;
  shortAddress: (address: string) => string;
};

export function AddressListModal(props: AddressListModalProps) {
  const profile = useProfile();

  useEffect(() => {
    if (!props.open) return;
    const addrs = props.addresses.slice(0, 24);
    if (addrs.length === 0) return;
    void Promise.all(addrs.map((a) => profile.loadProfile(a)));
  }, [profile, props.addresses, props.open]);

  return (
    <Modal open={props.open} title={props.title} onClose={props.onClose}>
      <div className="list">
        {props.isLoading ? <div className="muted">Loading…</div> : null}

        {!props.isLoading && props.addresses.length === 0 ? <div className="muted">{props.emptyText}</div> : null}

        {props.addresses.map((addr) => (
          <Link key={addr} className="listRow" to={`/profile/${addr}`} onClick={props.onClose}>
            <span className="listRowLeft">
              <div
                className="avatar tiny"
                style={(() => {
                  const key = addr.toLowerCase();
                  const p = profile.profilesByAddress[key];
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
