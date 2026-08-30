/** Which inline panel a post card has open. Lives here rather than on the card
 * so the footer can name it without importing the component that renders it. */
export type PostPanel = "comment" | "tip";
