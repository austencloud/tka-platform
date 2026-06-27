# R2 Bucket CORS (`tka-assets`)

Browser uploads (thumbnails, videos) PUT directly to R2 via presigned URLs
(`r2PresignUrl` Cloud Function → `R2VideoUploader`). R2 enforces CORS on those
PUTs against the **bucket's** CORS policy. That policy is bucket config, not code,
so it lived only in the Cloudflare dashboard and silently drifted out of sync with
the app's origins.

`r2-cors.json` is now the canonical source. Edit it, then apply:

```bash
npm run r2:cors:apply   # wrangler r2 bucket cors set tka-assets --file firebase-functions/r2-cors.json -y
npm run r2:cors:list    # verify
```

## Rules

1. **`app-and-local-dev-uploads`** — `PUT, GET, HEAD` from the production origins,
   the local dev server, and Capacitor native WebView origins. Exposes `ETag`
   (required so multipart video uploads can read part ETags).
2. **`public-read-any-origin`** — `GET, HEAD` from `*` so public URLs load
   cross-origin anywhere.

## Origin gotcha (the bug this fixed, 2026-06-26)

CORS matches the `Origin` header **exactly, including scheme and port**. The live
PUT allowlist contained only the two production origins
(`https://tkaflowarts.com`, `https://www.tkaflowarts.com`) — **no localhost entry
of any scheme**. The dev server runs on `https://localhost:5173` (confirmed by the
telemetry error message), so every browser PUT from local dev was rejected: it hit
`xhr.onerror` and showed "Sequence saved, but the thumbnail didn't generate" (the
save itself succeeds; only the R2 upload is blocked). Production was unaffected
because its origin was in the list. (Why localhost was absent — dropped, never
applied, or scheme drift after the dev server moved to HTTPS — isn't known; the
fix is to list every origin the app actually PUTs from.)

If you add a domain/port/scheme the app runs on, add it here and re-apply. Verify a
preflight succeeds:

```bash
curl -s -i -X OPTIONS \
  "https://<ACCOUNT_ID>.r2.cloudflarestorage.com/tka-assets/<any-key>" \
  -H "Origin: https://localhost:5173" \
  -H "Access-Control-Request-Method: PUT" | grep -i access-control-allow-origin
```
