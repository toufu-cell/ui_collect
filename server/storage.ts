import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Piece, SearchInput, SearchResult } from '../shared/types.ts';
import { CollectionError } from './errors.ts';
import {
    assertPlainDirectory,
    dataDirectory,
    MAX_FILE_BYTES,
    MAX_READ_BYTES,
    prepareRoot,
    readSafe,
    safeFile,
} from './paths.ts';

export const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja');
export function validId(id: string) {
    if (!/^ui-[a-f0-9-]{36}$/.test(id))
        throw new CollectionError('INVALID_ID', '登録済みのUI IDを指定してください。');
    return id;
}

export class Collection {
    root: string;
    db!: DatabaseSync;
    constructor(root = dataDirectory(), writable = false) {
        this.root = writable ? prepareRoot(root) : root;
        const path = join(this.root, 'collection.sqlite');
        if (!writable && !existsSync(path))
            throw new CollectionError(
                'NOT_INITIALIZED',
                '保存先が未作成です。npm run collection -- init を実行してください。',
                503,
            );
        if (existsSync(path)) safeFile(this.root, 'collection.sqlite', Number.MAX_SAFE_INTEGER);
        for (const suffix of ['-wal', '-shm'])
            if (existsSync(path + suffix))
                safeFile(this.root, 'collection.sqlite' + suffix, Number.MAX_SAFE_INTEGER);
        try {
            this.db = new DatabaseSync(path, { readOnly: !writable, timeout: 5000 });
            const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
            if (version !== 1 && !(writable && version === 0))
                throw new CollectionError(
                    'SCHEMA_VERSION',
                    '保存形式に対応していません。この保存先を作成したバージョンを使用してください。',
                    503,
                );
            if (writable) {
                this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
                if (!version)
                    this.db.exec(`BEGIN IMMEDIATE;
                    CREATE TABLE IF NOT EXISTS pieces (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, title TEXT NOT NULL, kind TEXT NOT NULL, category TEXT NOT NULL, search_text TEXT NOT NULL, created_at TEXT NOT NULL, metadata TEXT NOT NULL);
                    CREATE INDEX IF NOT EXISTS pieces_created ON pieces(created_at, id);
                    PRAGMA user_version=1; COMMIT;`);
            }
        } catch (error) {
            this.db!?.close();
            if (error instanceof CollectionError) throw error;
            throw new CollectionError(
                'DATABASE_ERROR',
                'DBを開けません。保存先・権限を確認し、collection doctor で診断してください。',
                503,
            );
        }
    }
    close() {
        this.db.close();
    }
    get(id: string): Piece {
        validId(id);
        const row = this.db.prepare('SELECT metadata FROM pieces WHERE id=?').get(id);
        if (!row)
            throw new CollectionError(
                'NOT_FOUND',
                'UIが見つかりません。検索し直してください。',
                404,
            );
        return JSON.parse(String(row.metadata));
    }
    byFingerprint(fingerprint: string): Piece | undefined {
        const row = this.db
            .prepare('SELECT metadata FROM pieces WHERE fingerprint=?')
            .get(fingerprint);
        return row ? JSON.parse(String(row.metadata)) : undefined;
    }
    publish(piece: Piece) {
        const searchText = normalize(
            [
                piece.id,
                piece.title,
                piece.name,
                piece.category,
                ...piece.tags,
                piece.description,
                piece.note,
            ].join(' '),
        );
        this.db
            .prepare('INSERT INTO pieces VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(
                piece.id,
                piece.fingerprint,
                piece.title,
                piece.kind,
                piece.category,
                searchText,
                piece.createdAt,
                JSON.stringify(piece),
            );
    }
    search(input: SearchInput = {}): SearchResult {
        const {
            query = '',
            kind = 'all',
            category = '',
            sort = 'catalog',
            offset = 0,
            limit = 36,
        } = input;
        if (
            query.length > 300 ||
            category.length > 40 ||
            !['all', 'component', 'screen'].includes(kind) ||
            !['catalog', 'reverse', 'name'].includes(sort) ||
            !Number.isInteger(offset) ||
            offset < 0 ||
            offset > 1_000_000 ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 50
        )
            throw new CollectionError(
                'INVALID_SEARCH',
                '検索条件を確認してください。取得件数は1〜50件です。',
            );
        const clauses: string[] = [];
        const values: string[] = [];
        for (const term of normalize(query).trim().split(/\s+/).filter(Boolean)) {
            clauses.push('instr(search_text, ?) > 0');
            values.push(term);
        }
        if (kind !== 'all') {
            clauses.push('kind=?');
            values.push(kind);
        }
        if (category && category !== 'すべて') {
            clauses.push('category=?');
            values.push(category);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const order =
            sort === 'name'
                ? 'title COLLATE NOCASE, id'
                : sort === 'reverse'
                  ? 'created_at DESC, id DESC'
                  : 'created_at, id';
        const items = this.db
            .prepare(`SELECT metadata FROM pieces ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
            .all(...values, limit, offset)
            .map((row) => JSON.parse(String(row.metadata)) as Piece);
        const total = Number(
            this.db.prepare(`SELECT count(*) AS count FROM pieces ${where}`).get(...values)?.count,
        );
        const stats = { total: 0, component: 0, screen: 0 };
        for (const row of this.db
            .prepare('SELECT kind, count(*) AS count FROM pieces GROUP BY kind')
            .all()) {
            stats[row.kind as 'component' | 'screen'] = Number(row.count);
            stats.total += Number(row.count);
        }
        const categories = this.db
            .prepare('SELECT DISTINCT category FROM pieces ORDER BY category')
            .all()
            .map((row) => String(row.category));
        return { items, total, stats, categories };
    }
    objectRoot(id: string) {
        assertPlainDirectory(this.root);
        assertPlainDirectory(join(this.root, 'objects'));
        return join(this.root, 'objects', validId(id));
    }
    bytes(id: string, path: string) {
        const piece = this.get(id);
        const file = piece.files.find((file) => file.path === path);
        if (!file)
            throw new CollectionError(
                'UNREGISTERED_FILE',
                '登録済みファイルだけを取得できます。',
                404,
            );
        const bytes = readSafe(this.objectRoot(id), path);
        if (bytes.length !== file.size || hash(bytes) !== file.sha256)
            throw new CollectionError(
                'CORRUPT_FILE',
                '保存ファイルが変更または破損しています。バックアップを確認してください。',
                409,
            );
        return bytes;
    }
    readFile(id: string, path: string, offset = 0, length = MAX_READ_BYTES) {
        if (
            !Number.isInteger(offset) ||
            offset < 0 ||
            offset > MAX_FILE_BYTES ||
            !Number.isInteger(length) ||
            length < 1 ||
            length > MAX_READ_BYTES
        )
            throw new CollectionError(
                'INVALID_RANGE',
                '取得範囲は0以上のoffsetと1〜65536のlengthで指定してください。',
            );
        const bytes = this.bytes(id, path);
        if (offset > bytes.length)
            throw new CollectionError('INVALID_RANGE', 'offsetがファイルサイズを超えています。');
        const chunk = bytes.subarray(offset, offset + length);
        return {
            path,
            offset,
            size: bytes.length,
            encoding: 'base64' as const,
            data: chunk.toString('base64'),
            nextOffset: offset + chunk.length < bytes.length ? offset + chunk.length : null,
            sha256: hash(bytes),
        };
    }
    doctor() {
        const issues: string[] = [];
        const integrity = this.db.prepare('PRAGMA quick_check').all();
        if (integrity.some((row) => row.quick_check !== 'ok')) issues.push('SQLite整合性エラー');
        const ids = this.db
            .prepare('SELECT id FROM pieces')
            .all()
            .map((row) => String(row.id));
        for (const id of ids) {
            try {
                for (const file of this.get(id).files) this.bytes(id, file.path);
            } catch (error) {
                issues.push(`${id}: ${error instanceof Error ? error.message : '取得失敗'}`);
            }
        }
        for (const name of readdirSync(join(this.root, 'objects')))
            if (!ids.includes(name)) issues.push(`未登録の保存物: objects/${name}`);
        for (const name of readdirSync(join(this.root, 'staging')))
            issues.push(`未完了の登録: staging/${name}`);
        return { ok: issues.length === 0, count: ids.length, issues };
    }
}
