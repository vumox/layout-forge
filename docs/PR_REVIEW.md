# Pull request decisions for 1.2.0

Reviewed on 2026-10-04 against the current release candidate. Decisions use the actual diffs, official upstream action versions, CI results and local production/browser checks.

| PR | Decision | Reason |
|---|---|---|
| [#1](https://github.com/vumox/layout-forge/pull/1) deploy-pages v5 | Apply | Official supported action; verify the production Pages deployment after the combined update. |
| [#2](https://github.com/vumox/layout-forge/pull/2) upload-pages-artifact v5 | Apply | Official Pages artifact action; compatible with the deployment workflow. |
| [#3](https://github.com/vumox/layout-forge/pull/3) setup-node v7 | Apply | CI passed on the existing hosted runner; Node 22 remains the application build runtime. |
| [#4](https://github.com/vumox/layout-forge/pull/4) checkout v7 | Apply | CI passed; resolve the adjacent-line conflict with setup-node while retaining both upgrades. |
| [#5](https://github.com/vumox/layout-forge/pull/5) Node typings 26.6.3 | Apply | Development types only; the complete candidate passes type checking, build and E2E. No new runtime API is introduced. |
| [#6](https://github.com/vumox/layout-forge/pull/6) TypeScript 7 | Defer | CI fails with TS5102 because `baseUrl` was removed. Requires a configuration migration and complete validation; keep TypeScript 6 for this release. Changes requested on the PR. |
| [#12](https://github.com/vumox/layout-forge/pull/12) 3D bundle | Apply | Used runtime members remain available. All ten presets render and export PNG snapshots. The production chunk falls from about 773 kB to 588 kB. |
| [#13](https://github.com/vumox/layout-forge/pull/13) layout tests | Apply | Meaningful regression coverage for tree traversal, track edits, placement, duplication, responsive CSS and escaping. No runtime changes. Keep issue #7 open for the remaining coverage. |
| [#14](https://github.com/vumox/layout-forge/pull/14) mockup history | Apply | Removes five React warnings without suppressions. Browser checks pass for add, undo/redo, pointer movement, redo invalidation, lock/hide and PNG export. |

## Release validation

- 48 unit tests and 17 Playwright scenarios pass on the combined candidate.
- Type checking, lint and the production build pass. Nine existing lint warnings remain; the 3D chunk still produces the existing size warning.
- The review also exposed a mockup sharing mismatch (`lf-tool-mockup2` versus the tool's URL name). The release fixes it and adds unit/browser round-trip coverage.
- Pages deployment and the public site's sharing, search, offline usage and SEO routes are checked before publishing the release.

## Primary references

- [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [upload-pages-artifact](https://github.com/actions/upload-pages-artifact), [deploy-pages](https://github.com/actions/deploy-pages).
- [TypeScript 7 CI failure](https://github.com/vumox/layout-forge/actions/runs/37226242877).
