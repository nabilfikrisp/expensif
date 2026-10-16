/**
 * Maps a deployment proxy kind to the header carrying the real client IP.
 * The only place proxy vendor names appear.
 *
 * Each entry claims the proxy overwrites the header and that it holds a single
 * IP. Only add verified entries. `none` means no trusted proxy.
 */
const CLIENT_IP_HEADERS = {
  none: undefined,
  cloudflare: "cf-connecting-ip",
  // Requires `proxy_set_header X-Real-IP $remote_addr;` in the nginx config.
  nginx: "x-real-ip",
} as const;

export type ProxyKind = keyof typeof CLIENT_IP_HEADERS;

/** Valid `DEPLOY_PROXY` values, for `z.enum()`. Tuple type is required by zod. */
export const PROXY_KINDS = Object.keys(CLIENT_IP_HEADERS) as [ProxyKind, ...ProxyKind[]];

/** Header name for the given proxy, or `undefined` to use the socket address. */
export const clientIpHeaderFor = (proxy: ProxyKind): string | undefined => CLIENT_IP_HEADERS[proxy];
