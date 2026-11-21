# Authorization Matrix (M1 draft)

Enforced server-side in the BFF (user) and trace-api (service token). ✅ allowed · ❌ denied (401/403/404) · — not deployed.

| Route / endpoint | Anonymous (operator-prod) | Operator (operator-prod) | local-dev bootstrap | Anonymous (public-demo) |
| --- | --- | --- | --- | --- |
| `/`, `/docs/*` | ✅ | ✅ | ✅ | ✅ |
| `/login` | ✅ | ✅ (redirect to `/app`) | ✅ | ❌ 404 |
| `/demo`, `/demo/traces/[id]` | ❌ 404 (demo is separate deployment) | ❌ 404 | ✅ (local synthetic preview) | ✅ |
| `/app/*` pages | ❌ → `/login?next=` | ✅ | ✅ | ❌ 404 |
| BFF private data routes | ❌ 401 | ✅ | ✅ | ❌ 404 |
| BFF demo data routes | ❌ 404 | ❌ 404 | ✅ | ✅ read-only |
| Settings mutation | ❌ 401 | ✅ (+CSRF/Origin, audit) | ✅ | ❌ 404 |
| trace-api query `:8080` | private network + token only | — | — | private network + demo token; PATCH → 403 |
| trace-api ingest `:4318` | private network only | — | — | **disabled** |
| Collector OTLP | private network only | — | `127.0.0.1` bind optional | — |
