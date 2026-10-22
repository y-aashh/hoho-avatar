import { build } from 'vite';
import { resolve } from 'node:path';

// The public site ships only Pixel Bot. Caller-owned Live2D assets are not copied.
await build({ configFile: 'examples/basic/vite.config.mjs', mode: 'pages',
  build: { outDir: resolve('examples/basic/dist') } });
console.log('Pages build includes Pixel Bot and the Studio; no additional character fixtures.');
