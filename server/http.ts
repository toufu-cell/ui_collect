import type { IncomingMessage, ServerResponse } from 'node:http';
import { Collection } from './storage.ts';
import { CollectionError, errorInfo } from './errors.ts';
import { rasterType } from './paths.ts';
import { randomUUID } from 'node:crypto';
import { withPreviewToken } from './preview-html.ts';

export function json(response: ServerResponse, status: number, value: unknown) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(value));
}
export function guard(request: IncomingMessage, response: ServerResponse, port: number) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
        'Content-Security-Policy',
        "frame-src 'none'; form-action 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Cache-Control', 'no-store');
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (
        !allowedHosts.includes(request.headers.host ?? '') ||
        (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) ||
        request.headers['sec-fetch-site'] === 'cross-site'
    ) {
        json(response, 403, {
            code: 'FORBIDDEN_ORIGIN',
            message: 'ローカルのコレクション画面からアクセスしてください。',
        });
        return false;
    }
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        json(response, 405, { code: 'READ_ONLY', message: '読み取り操作のみ利用できます。' });
        return false;
    }
    return true;
}
export function handleApi(request: IncomingMessage, response: ServerResponse, root: string) {
    const url = new URL(request.url!, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;
    let collection: Collection | undefined;
    try {
        collection = new Collection(root);
        if (url.pathname === '/api/ui') {
            const input = Object.fromEntries(url.searchParams);
            if (
                Object.keys(input).some(
                    (key) =>
                        !['query', 'kind', 'category', 'sort', 'offset', 'limit'].includes(key),
                )
            )
                throw new CollectionError('INVALID_SEARCH', '未対応の検索条件です。');
            json(
                response,
                200,
                collection.search({
                    ...input,
                    offset: input.offset === undefined ? 0 : Number(input.offset),
                    limit: input.limit === undefined ? 36 : Number(input.limit),
                }),
            );
        } else {
            const parts = url.pathname.split('/');
            const [, , section, id, action] = parts;
            if (section !== 'ui' || !id || parts.length > 5)
                throw new CollectionError('NOT_FOUND', 'APIが見つかりません。', 404);
            const piece = collection.get(id);
            if (!action) json(response, 200, piece);
            else if (action === 'preview') {
                const token = randomUUID();
                json(response, 200, {
                    html: withPreviewToken(
                        collection.bytes(id, 'generated/preview.html').toString(),
                        token,
                    ),
                    token,
                });
            } else if (action === 'thumbnail' || action === 'reference') {
                const bytes = collection.bytes(
                    id,
                    action === 'thumbnail' ? 'generated/thumbnail.png' : piece.source.reference,
                );
                response.writeHead(200, {
                    'Content-Type': rasterType(bytes),
                    'Content-Length': bytes.length,
                });
                response.end(bytes);
            } else if (action === 'file') {
                json(
                    response,
                    200,
                    collection.readFile(
                        id,
                        url.searchParams.get('path') ?? '',
                        Number(url.searchParams.get('offset') ?? 0),
                        Number(url.searchParams.get('length') ?? 65536),
                    ),
                );
            } else throw new CollectionError('NOT_FOUND', 'APIが見つかりません。', 404);
        }
    } catch (error) {
        json(response, error instanceof CollectionError ? error.status : 500, errorInfo(error));
    } finally {
        collection?.close();
    }
    return true;
}
