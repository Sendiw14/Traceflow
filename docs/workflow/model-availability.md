# Model & Environment Availability Log

Record what was actually observed, never assumed.

## 2026-11-22 — M0 coordinator session

| Item | Observed | Method | Status |
| --- | --- | --- | --- |
| Claude Code version | 2.1.319 (≥ 2.1.284 needed for `/effort ultracode` toggle) | `claude --version` | PASS |
| Model | `claude-opus-5-5` (Opus 5.5) | Session system info | PASS |
| Effort level | Not inspectable from inside this session | — | NOT TESTED |
| Ultracode mode | Not inspectable from inside this session | — | NOT TESTED |
| Sonnet 5.5 high frontend session | Not started | — | NOT TESTED |
| Host | macOS (Darwin 27.0.0), arm64, 10 CPU, 16 GiB RAM, 90 GiB free disk | `sysctl`, `df` | Recorded |
| Go | 1.27.4 darwin/arm64 | `go version` | Matches baseline |
| Node.js | 24.11.1 | `node --version` | Below baseline 26.x LTS (R-11) |
| pnpm | 9.15.9 | `pnpm --version` | Recorded; pin at M2 |
| Docker | Server 29.5.2 | `docker version` | PASS |
| PostgreSQL | Local client 14.20 only; server will be 18.x container | `psql --version` | Recorded |
| GitHub | `gh` authenticated as repo owner; remote repo empty | `gh api` | Recorded |

**Owner action:** verify `/model`, `/effort`, `/status` in this and the frontend session and fill the NOT TESTED rows.

## 2026-11-22 — M1 design/consumer session (Sonnet)

| Item | Observed | Method | Status |
| --- | --- | --- | --- |
| Model | `claude-sonnet-5-5` (Sonnet 5.5) | Session system prompt | PASS (as reported by the harness) |
| Effort level | Task asked for `high`; not inspectable from inside the session (`/effort`, `/model`, `/status` are not available in this app's session) | — | NOT TESTED |
| Ultracode mode | Not inspectable from inside the session | — | NOT TESTED |
| Claude Code version | 2.1.319 | `claude --version` | PASS |
| Node.js | v24.11.1 (below baseline 26.x LTS, R-11) | `node --version` | Recorded |
| Python | stdlib `python3` used only for `docs/design/tools/contrast.py` | — | Recorded |
| Network | No external fetch performed; font licences/product references not verified online | — | NOT TESTED |

**Owner action:** confirm `/model`, `/effort`, `/status` in the frontend session and fill the NOT TESTED rows.
