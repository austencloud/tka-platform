// The book preview is a client-only interactive viewer (pdf.js + StPageFlip,
// both of which manipulate the DOM directly). SSR would only produce markup that
// fails to hydrate, so render it on the client.
export const ssr = false;
