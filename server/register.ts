import { mkdirSync, writeFileSync, renameSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { FileInfo, Piece } from '../shared/types.ts';
import { parseManifest } from './manifest.ts';
import { Collection, hash } from './storage.ts';
import { CollectionError } from './errors.ts';
import { MAX_PACKAGE_BYTES, mimeType, rasterType, readSafe } from './paths.ts';

export function runWorker(stage: string, timeoutMs = 45_000) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000)
        throw new CollectionError('INVALID_TIMEOUT', '期限は1000〜120000ミリ秒です。');
    return new Promise<void>((resolvePromise, reject) => {
        const child = spawn(
            process.execPath,
            [
                fileURLToPath(new URL('./render-worker.ts', import.meta.url)),
                stage,
                String(timeoutMs),
            ],
            {
                detached: true,
                stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
                env: {
                    PATH: process.env.PATH,
                    HOME: process.env.HOME,
                    FORMSHELF_BROWSER_CHANNEL: process.env.FORMSHELF_BROWSER_CHANNEL,
                },
            },
        );
        let errorText = '';
        let timedOut = false;
        child.stderr!.on('data', (bytes) => {
            errorText = (errorText + String(bytes)).slice(-4000);
        });
        const terminate = () => {
            if (child.pid) {
                try {
                    process.kill(-child.pid, 'SIGKILL');
                } catch {
                    /* Worker already exited. */
                }
            }
        };
        const timer = setTimeout(() => {
            timedOut = true;
            terminate();
        }, timeoutMs);
        const abort = () => {
            terminate();
        };
        process.once('SIGINT', abort);
        process.once('SIGTERM', abort);
        child.once('error', reject);
        child.once('close', (code) => {
            clearTimeout(timer);
            process.off('SIGINT', abort);
            process.off('SIGTERM', abort);
            terminate();
            if (timedOut)
                reject(
                    new CollectionError(
                        'RENDER_TIMEOUT',
                        '描画が期限内に完了しませんでした。コードを確認して登録し直してください。',
                    ),
                );
            else if (code !== 0)
                reject(
                    new CollectionError(
                        'RENDER_FAILED',
                        `プレビューを作成できませんでした: ${errorText}`,
                    ),
                );
            else resolvePromise();
        });
    });
}

export async function registerPackage(packagePath: string, root: string, timeoutMs?: number) {
    const sourceRoot = realpathSync(resolve(packagePath));
    const manifest = parseManifest(
        JSON.parse(readSafe(sourceRoot, 'manifest.json', 64 * 1024).toString('utf8')),
    );
    const files: FileInfo[] = [];
    const content = new Map<string, Buffer>();
    let size = 0;
    for (const path of [...manifest.files].sort()) {
        const bytes = readSafe(sourceRoot, path);
        size += bytes.length;
        if (size > MAX_PACKAGE_BYTES)
            throw new CollectionError(
                'PACKAGE_TOO_LARGE',
                '登録ファイルの合計は40MiB以内にしてください。',
            );
        content.set(path, bytes);
        files.push({ path, size: bytes.length, sha256: hash(bytes), mime: mimeType(path) });
    }
    // Recording packages retain a still reference so the gallery never auto-plays a video.
    rasterType(content.get(manifest.source.reference)!);
    const fingerprint = hash(
        JSON.stringify({
            ...manifest,
            files: [...manifest.files].sort(),
            dependencies: Object.fromEntries(Object.entries(manifest.dependencies).sort()),
        }) + JSON.stringify(files),
    );
    const collection = new Collection(root, true);
    let stage: string;
    const id = `ui-${randomUUID()}`;
    try {
        const existing = collection.byFingerprint(fingerprint);
        if (existing) {
            for (const file of existing.files) collection.bytes(existing.id, file.path);
            return { id: existing.id, reused: true };
        }
        stage = join(collection.root, 'staging', id);
        mkdirSync(stage, { mode: 0o700 });
        for (const [path, bytes] of content) {
            mkdirSync(dirname(join(stage, path)), { recursive: true });
            writeFileSync(join(stage, path), bytes, { flag: 'wx', mode: 0o600 });
        }
        writeFileSync(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 4), {
            flag: 'wx',
            mode: 0o600,
        });
    } finally {
        collection.close();
    }
    await runWorker(stage, timeoutMs);
    for (const path of ['manifest.json', 'generated/preview.html', 'generated/thumbnail.png']) {
        const bytes = readSafe(stage, path);
        files.push({ path, size: bytes.length, sha256: hash(bytes), mime: mimeType(path) });
    }
    const piece: Piece = {
        ...manifest,
        files,
        id,
        fingerprint,
        createdAt: new Date().toISOString(),
    };
    const writer = new Collection(root, true);
    try {
        writer.db.exec('BEGIN IMMEDIATE');
        const existing = writer.byFingerprint(fingerprint);
        if (existing) {
            writer.db.exec('ROLLBACK');
            return {
                id: existing.id,
                reused: true,
                diagnostic: `同時登録の作業領域が残っています: ${stage}`,
            };
        }
        renameSync(stage, writer.objectRoot(id));
        writer.publish(piece);
        writer.db.exec('COMMIT');
        return { id, reused: false };
    } catch (error) {
        try {
            writer.db.exec('ROLLBACK');
        } catch {
            /* No active transaction. */
        }
        throw error;
    } finally {
        writer.close();
    }
}
