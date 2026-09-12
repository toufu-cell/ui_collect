import { backup, DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, renameSync, rmdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { Collection } from './storage.ts';
import { CollectionError } from './errors.ts';
import { isWithin } from './paths.ts';

export async function copyCollection(source: string, destination: string) {
    if (!isAbsolute(destination) || isWithin(source, destination))
        throw new CollectionError(
            'INVALID_DESTINATION',
            'コピー先は保存元の外にある新しい絶対パスにしてください。',
        );
    const current = new Collection(source);
    let snapshot: Collection | undefined;
    try {
        // Exclusive directory creation reserves the destination; an interrupted copy is never overwritten.
        mkdirSync(destination, { mode: 0o700 });
        mkdirSync(join(destination, 'objects'), { mode: 0o700 });
        mkdirSync(join(destination, 'staging'), { mode: 0o700 });
        const pendingRoot = join(destination, 'staging', 'snapshot');
        mkdirSync(pendingRoot, { mode: 0o700 });
        await backup(current.db, join(pendingRoot, 'collection.sqlite'));
        const standalone = new DatabaseSync(join(pendingRoot, 'collection.sqlite'));
        try {
            standalone.exec('PRAGMA journal_mode=DELETE');
        } finally {
            standalone.close();
        }
        snapshot = new Collection(pendingRoot);
        const ids = snapshot.db
            .prepare('SELECT id FROM pieces ORDER BY id')
            .all()
            .map((row) => String(row.id));
        for (const id of ids) {
            for (const file of snapshot.get(id).files) {
                const bytes = current.bytes(id, file.path);
                const path = join(destination, 'objects', id, file.path);
                mkdirSync(dirname(path), { recursive: true });
                writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
            }
        }
        snapshot.close();
        snapshot = undefined;
        renameSync(join(pendingRoot, 'collection.sqlite'), join(destination, 'collection.sqlite'));
        rmdirSync(pendingRoot);
        return { destination, count: ids.length };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
            throw new CollectionError(
                'DESTINATION_EXISTS',
                'コピー先が既にあります。別の新しい保存先を指定してください。',
            );
        throw error;
    } finally {
        snapshot?.close();
        current.close();
    }
}
