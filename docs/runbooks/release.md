# Runbook — Cutting a release

**Pipeline:** `.github/workflows/release.yml`. **Owner actions are marked (owner).** Nothing is published without a human step.

## Preconditions
- `main` is green in CI for the commit you will tag.
- `docs/testing/release-evidence.md` reviewed; every open row has an owner decision (spec §17: no release claim without evidence).
- Third-party image findings decided (`docs/security/security-testing.md`).

## Steps
1. **Changelog:** move the `## [Unreleased]` content to `## [X.Y.Z] - YYYY-MM-DD` in `CHANGELOG.md`, leave an empty `## [Unreleased]`, commit to `main` and wait for CI to pass.
2. **Tag (owner):** `git tag -a vX.Y.Z -m "TRACEFLOW vX.Y.Z" && git push origin vX.Y.Z`.
3. The workflow then:
   - checks the tag is on `main`, CI succeeded for that commit, and the CHANGELOG section exists;
   - builds `ghcr.io/<owner>/traceflow-trace-api:X.Y.Z` and `ghcr.io/<owner>/traceflow-web:X.Y.Z` with OCI labels;
   - fails on fixable CRITICAL/HIGH findings (Trivy) and produces CycloneDX SBOMs;
   - pushes both images to GHCR and creates a **draft** GitHub Release with the changelog section, the image digests (as `.env.production` lines) and the SBOMs.
4. **Review the draft (owner):** notes, digests, SBOMs, evidence link. **Publishing the draft is the release approval.**
5. **GHCR visibility (owner):** new packages may default to private; set visibility deliberately in the package settings.
6. **Deploy:** put the digest lines into `.env.production` and follow `deployment.md` → *Update*.

## Dry run (no publishing)
Actions → *release* → *Run workflow* on `main` (or `gh workflow run release.yml --ref main`): builds, scans and uploads SBOMs as an artifact; pushes nothing and creates no release.

## If a gate fails
- *tag is not on main* / *no successful CI run*: delete the tag (`git push --delete origin vX.Y.Z`), fix, re-tag.
- *CHANGELOG has no section*: same; the section header must be exactly `## [X.Y.Z] - YYYY-MM-DD`.
- Trivy failure: fix the dependency or base image; never weaken the gate for a release.
