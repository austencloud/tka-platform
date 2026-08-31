const CANONICAL_ORIGIN = "https://tkaflowarts.com";
const CREATE_URL = `${CANONICAL_ORIGIN}/create`;
const LEGACY_SEQUENCE_PREFIX = "/sequence/";

export function resolveLegacyRedirect(requestUrl) {
  const source = new URL(requestUrl);

  if (source.pathname.startsWith(LEGACY_SEQUENCE_PREFIX)) {
    const code = source.pathname.slice(LEGACY_SEQUENCE_PREFIX.length);
    if (code && !code.includes("/")) {
      const target = new URL(`/q/${code}`, CANONICAL_ORIGIN);
      target.search = source.search;
      return target;
    }
  }

  return new URL(CREATE_URL);
}

export default {
  fetch(request) {
    return Response.redirect(resolveLegacyRedirect(request.url), 301);
  },
};
