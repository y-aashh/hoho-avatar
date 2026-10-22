# Example asset licensing

Pixel Bot is the only bundled public character and the only artwork included in the distributable SDK, copied into `dist-sdk/characters/pixel-bot/` with its MIT license. Recordings and phonemizer data are excluded from the npm file allowlist.

`public/characters/pixel-bot` is original project artwork under the repository's [MIT License](LICENSE). Its optional reaction eyes, eyebrows, delighted mouth and transparent sweat-drop PNG are original procedurally authored pixel layers under the same license.

Contributors adding an example character must own the artwork or have explicit redistribution rights. Document its source and license here. Do not commit private reference images, temporary generations, or assets whose redistribution terms are unclear. Private characters under `working/characters/` are not public demo assets.

## Live2D

The optional Live2D renderer uses PixiJS and pixi-live2d-display with MIT notices in `public/licenses/`. Embedded Cubism framework components have Live2D's separate Open Software License. Core and model assets are caller-owned and are not bundled in the public site or npm SDK. The optional Wankoromochi test fixture is cached only in ignored `tmp/live2d-sample`; see [docs/LIVE2D.md](docs/LIVE2D.md).

## Speech synthesis data

`public/espeak-en-dict.tsv` and `public/en_rules` are copied from the
[`kitten-tts-webgpu` public assets](https://github.com/svenflow/kitten-tts-webgpu/tree/main/public).
They are required because version 0.1.1 of the published npm package references
these files at runtime but does not include them in the package archive. The
upstream project attributes the dictionary and rule data to espeak-ng and marks
those data files as GPL-3.0. They are not covered by this repository's MIT
License.

Full license texts, copyright notices and pinned source references are distributed in `public/licenses/`, `public/third-party-notices.html` and `public/third-party-sources.json`. Vite copies these files unchanged into the deployed demo. The rules retain their original copyright header and GPL-3.0-or-later notice; both data files match the recorded upstream checksums.

The Phonemizer.js JavaScript wrapper is Apache-2.0; its native eSpeak backend retains separate GPL terms. The upstream archive includes a worker/data distribution but does not identify the complete native build provenance. License text and source links do not by themselves establish a complete corresponding-source package for that backend.

## Sample audio

`public/audio/sample-voice.wav` is an AI-generated English greeting made with Azure OpenAI's stock `marin` voice, distributed under the project MIT license and excluded from the SDK npm package.
