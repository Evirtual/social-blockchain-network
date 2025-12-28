type Props = {
  onDismiss: () => void;
};

export function HomeHeroIntro(props: Props) {
  return (
    <section className="card hero">
      <button
        className="iconButton ghost heroClose"
        type="button"
        aria-label="Dismiss intro"
        onClick={props.onDismiss}
      >
        ×
      </button>

      <div className="heroTitle">A social blockchain network where posts are NFTs</div>
      <div className="heroSub muted">
        Mint posts on-chain. Likes and comments are wallet-signed interactions. Tips go directly to creators.
      </div>
      <div className="heroBullets">
        <div className="pill">On-chain posts</div>
        <div className="pill">Signed reactions</div>
        <div className="pill">Creator tips</div>
        <div className="pill">IPFS media</div>
      </div>
    </section>
  );
}
