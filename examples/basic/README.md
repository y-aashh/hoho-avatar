# Avatar Studio

Run `npm ci`, `npm run setup:demo`, and `npm run dev` at the repository root, then open `http://127.0.0.1:5173/hoho-avatar/`.

The Studio imports SDK source and bundles only Pixel Bot. Microphone, audio files, local TTS and voice-agent controls share the same audio path. Import a V1 character ZIP through **Import avatar** or drag it onto the stage. Reactions, hold duration, idle sway, mouth previews and blinking use the mounted Avatar.

The optional Live2D adapter remains available for caller-owned models configured through `VITE_LIVE2D_MODEL_URL`, `VITE_LIVE2D_CORE_URL` and `VITE_LIVE2D_NAME`. Its dependencies load only when selected. The official local test fixture requires `npm run setup:live2d-sample` plus explicit `VITE_LIVE2D_SAMPLE=true`; it is never included in the public build. See [the Live2D guide](../../docs/LIVE2D.md).

Three.js, Blender sources and GLB import are no longer supported. Private characters under `working/characters/` are not modified or copied into public output.
