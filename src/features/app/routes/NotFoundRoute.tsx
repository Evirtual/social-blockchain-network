import { Link } from "react-router-dom";

/**
 * Unknown addresses used to render the feed. A visitor following a stale link
 * to a burned post or an old profile saw the home page and no indication that
 * the address was wrong, which reads as though the link worked.
 */
export function NotFoundRoute() {
  return (
    <section className="card notFound" aria-labelledby="notFoundTitle">
      <h2 id="notFoundTitle">That page doesn&rsquo;t exist</h2>
      <p>
        The address may be mistyped, or it pointed at a post that has since been burned. Posts are NFTs, so a burned
        one is gone from the chain rather than hidden.
      </p>
      <Link className="primary" to="/">
        Back to the feed
      </Link>
    </section>
  );
}
