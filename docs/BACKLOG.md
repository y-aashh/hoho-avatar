# Backlog

## Voice agent follow-ups

- add a production deployment example for the Managed Identity gateway;
- add tool-call handling and explicit tool authorization boundaries;
- add automatic reconnect and conversation restoration policies (manual retry starts a fresh session today);
- replace the browser-to-gateway WebSocket with WebRTC when the Azure deployment supports the required server-side control pattern.

Microphone capture has migrated to the shared 20 ms `AudioWorklet` in SDK source. The unified Studio imports local source and includes it.

The browser SDK builds independently from the demo. SDK previews use the public npm `next` tag.

## Package distribution

Implemented:

- `@hh1st/hoho-avatar` ESM, declarations, source maps and an explicit exports/files contract;
- `createAvatar()` for microphone, local files and external PCM;
- original MIT Pixel Bot assets, with no Azure or KittenTTS runtime dependencies;
- separate `dist-sdk/` and demo `examples/basic/dist/` output;
- clean tarball installation with native browser and Vite production verification;
- tag-driven trusted-publishing workflow, changelog and release guidance.

Release operations:

- configure the npm trusted publisher / GitHub npm environment for subsequent automated releases;
- review and authorize each version tag and registry publication;
- consider framework adapters and consumer checks for additional bundlers.

## Dependency reproducibility

Status: implemented for source development, the standalone demo and CI.

The repository and `examples/basic/` commit public-registry lockfiles. CI installs both with `npm ci`; the unified demo imports SDK source and the package-consumer tests independently verify tarball installs.

## Renderer support

Canvas and optional Live2D adapters share one Avatar API, RenderFrame and audio owner. Pixel Bot is the default; Mira and Arthur are the smooth illustrated public showcase characters. Caller-owned V1 sprite ZIPs and configured Live2D models remain supported.

Three.js, GLB import and Blender authoring have been removed from the supported source and package entries. Private working characters are outside the public asset library.
