# Repository context

- This repository ships the existing Node/Bun package and the Go CLI/GUI as parallel products. Do not treat the Go implementation as permission to remove or silently diverge from the Node implementation.
- Use Bun for every JavaScript workspace in this repository. Do not use npm or pnpm. Keep the root and `go/gui/frontend` lockfiles independent.
- Use PowerShell syntax for local commands on Windows and prefer `/` in generated paths.

# Shared behavior and fixtures

- Treat `fixtures/` as the cross-implementation contract. When a fixture exposes a parser or metadata bug, update both Node and Go behavior unless the user explicitly narrows the scope.
- Keep fixture coverage capability-driven: cover distinct DOM and metadata shapes such as single-disc, multi-disc, no-cover, tabbed lyrics, and fallback artist/composer cases instead of collecting redundant pages.
- Do not automate THBWiki crawling or fixture refreshes. THBWiki fixtures are maintained from user-provided local captures because the site has strict anti-scraping behavior.
- Keep `fixtures/`, `go/`, and test data out of the published Node package. Preserve the package-boundary check in CI.

# Go architecture

- Keep reusable behavior in `go/internal`: domain types in `domain`, orchestration in `application`, source integrations in `source`, and composition in `bootstrap`.
- Keep `go/cmd/thtag` and `go/gui` thin. The CLI and GUI should call the same application services instead of reimplementing scan, planning, write, rename, rollback, image, or metadata logic.
- Preserve explicit filesystem safety in write and rename flows: preview before commit, detect post-preview changes, stage writes, and retain rollback behavior.
- Use the pinned Go and Wails versions from `go/go.mod` and `go/gui/Taskfile.yml`. Do not independently upgrade Wails or its generated bindings.
- Windows icons and version resources belong beside the corresponding `main` package as architecture-specific `.syso` files. Generate GUI resources through the existing Wails task and keep CLI and GUI branding sourced from `assets/logo.ico`.

# GUI architecture and design

- Build the desktop app with Wails v3, Vue 3, TypeScript, Vite, PrimeVue, and Pinia. Frontend source must use `.ts`/`.tsx`; do not add Vue SFC (`.vue`) files or restore `vue-tsc`.
- Keep Wails access behind the `GUIApi` boundary in `go/gui/frontend/src/api`. Components and stores must not import generated Wails services directly. Maintain matching native and fixture adapters when the API changes.
- Do not hand-edit `go/gui/frontend/bindings` or `go/gui/frontend/embed/dist`; regenerate them through the Wails/Vite tasks.
- Keep business rules in Go. The frontend owns presentation, interaction state, and explicit DTO adaptation only.
- Prefer a compact desktop-tool layout: avoid card-heavy page framing, redundant descriptions, and oversized controls. Apply visual changes consistently across tagging, batch, settings, dialogs, empty states, and loading states.
- Loading must not introduce layout shifts, duplicate cover placeholders, or transient controls that cannot be used. Derive UI state from the active operation instead of maintaining parallel flags.

# GUI verification

- For layout and interaction work, start the Vite frontend and use `http://127.0.0.1:9245/?fixture=1`. Fixture mode must remain offline and must not modify real music files.
- Inspect GUI behavior with the connected Chrome browser. Use targeted DOM/state reads and scoped screenshots; avoid full-page snapshots that embed large cover images.
- Use the native Wails app when validating file dialogs, window state, generated bindings, native events, or real filesystem behavior. Do not claim native behavior is verified from fixture mode alone.
- If the Wails `server` build tag is needed for browser-bridge validation, do not rely on a native Windows server build with the current Wails alpha. Cross-build the server target for Linux and run it through WSL, using the repository fixtures and the `THTAG_GUI_FIXTURES_ROOT` / `THTAG_GUI_FIXTURE_DIR` environment variables.

# Validation

- Run only the checks relevant to the changed surface, but do not stop at compilation.
- Root Node package: `bun run build`, `bun run test`, `bun run lint`, and `bun run format:check`.
- Go module, from `go/`: `go test ./...`, `golangci-lint run --config .golangci.yml`, and `go build -trimpath -o ./bin/thtag.exe ./cmd/thtag`.
- GUI frontend, from `go/gui/frontend/`: `bun run build`.
- Full Windows GUI, from `go/gui/`: `& './.task/bin/wails3.exe' task build`; verify `go/bin/TouhouTagger.exe` exists and launch it when native behavior changed.
- WASM changes: rebuild through `go/wasm-src/build.ps1`, then validate behavior with `go build ./cmd/thtag` and `go test ./internal/imagecodec/...`. Do not use generated WASM hash equality as the sole acceptance criterion.
