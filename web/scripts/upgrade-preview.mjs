import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Safely serve any existing worktree without changing its branch or tracked files.
const root = path.resolve(process.argv[2] ?? '..');
const web = path.join(root, 'web');
const port = Number(process.argv[3] ?? 5270);
process.chdir(web); // Tailwind's content paths resolve from this working directory.
const { createServer } = await import(pathToFileURL(path.join(web, 'node_modules/vite/dist/node/index.js')));
const server = await createServer({
  root: web,
  cacheDir: path.join(web, 'node_modules/.vite-upgrade', path.basename(root)),
  server: { host: '127.0.0.1', port, strictPort: true },
});
await server.listen();
server.printUrls();
