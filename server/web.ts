import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { guard, handleApi, json } from './http.ts';
import { dataDirectory, mimeType, readSafe } from './paths.ts';

const port = Number(process.env.PORT ?? 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('PORTは1024〜65535で指定してください。');
const root = dataDirectory();
const dev = process.argv.includes('--dev');
const appRoot = fileURLToPath(new URL('../', import.meta.url));
const vite = dev
    ? await (
          await import('vite')
      ).createServer({
          root: appRoot,
          server: { middlewareMode: true, host: '127.0.0.1' },
          appType: 'spa',
      })
    : undefined;
const server = createServer((request, response) => {
    if (!guard(request, response, port) || handleApi(request, response, root)) return;
    if (vite) {
        vite.middlewares(request, response);
        return;
    }
    try {
        const path = decodeURIComponent(new URL(request.url!, 'http://localhost').pathname);
        const name = path === '/' ? 'index.html' : path.slice(1);
        if (name !== 'index.html' && name !== 'favicon.svg' && !name.startsWith('assets/')) {
            json(response, 404, { message: 'ページが見つかりません。' });
            return;
        }
        const bytes = readSafe(join(appRoot, 'dist'), name);
        const mime = name.endsWith('.js') ? 'text/javascript' : mimeType(name);
        response.writeHead(200, { 'Content-Type': mime });
        response.end(bytes);
    } catch {
        json(response, 404, {
            message: 'ファイルが見つかりません。npm run build を実行してください。',
        });
    }
});
server.listen(port, '127.0.0.1', () =>
    process.stderr.write(`Formshelf: http://127.0.0.1:${port}\n保存先: ${root}\n`),
);
async function stop() {
    await vite?.close();
    server.close();
    server.closeAllConnections();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
