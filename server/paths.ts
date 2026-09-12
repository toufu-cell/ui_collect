import {
    constants,
    existsSync,
    lstatSync,
    mkdirSync,
    openSync,
    fstatSync,
    closeSync,
    readSync,
    realpathSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { CollectionError } from './errors.ts';

export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_PACKAGE_BYTES = 40 * 1024 * 1024;
export const MAX_FILES = 160;
export const MAX_READ_BYTES = 64 * 1024;

export function dataDirectory(value = process.env.FORMSHELF_DATA_DIR) {
    const root = value ?? join(homedir(), '.local', 'share', 'formshelf');
    if (!isAbsolute(root))
        throw new CollectionError(
            'INVALID_ROOT',
            'FORMSHELF_DATA_DIR は絶対パスで指定してください。',
        );
    return resolve(root);
}

export function assertPlainDirectory(path: string) {
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new CollectionError(
            'UNSAFE_PATH',
            '保存先には通常のディレクトリを指定してください。',
        );
}

export function prepareRoot(root: string) {
    if (!isAbsolute(root))
        throw new CollectionError('INVALID_ROOT', '保存先は絶対パスで指定してください。');
    mkdirSync(root, { recursive: true, mode: 0o700 });
    assertPlainDirectory(root);
    const canonical = realpathSync(root);
    for (const name of ['objects', 'staging']) {
        const target = join(canonical, name);
        if (!existsSync(target)) mkdirSync(target, { mode: 0o700 });
        assertPlainDirectory(target);
    }
    return canonical;
}

export function relativeFile(value: string) {
    if (
        !value ||
        value.length > 260 ||
        isAbsolute(value) ||
        /[\\\0:]/.test(value) ||
        value.split('/').some((part) => !part || part === '.' || part === '..') ||
        value.split('/').length > 12
    ) {
        throw new CollectionError(
            'UNSAFE_PATH',
            'ファイル名には保存先内の相対パスを指定してください。',
        );
    }
    return value;
}

export function isWithin(root: string, target: string) {
    const path = relative(root, target);
    return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

export function safeFile(root: string, name: string, maxBytes = MAX_FILE_BYTES) {
    relativeFile(name);
    assertPlainDirectory(root);
    const canonical = realpathSync(root);
    const parts = name.split('/');
    let path = canonical;
    try {
        for (const [index, part] of parts.entries()) {
            path = join(path, part);
            const stat = lstatSync(path);
            if (
                stat.isSymbolicLink() ||
                (index < parts.length - 1
                    ? !stat.isDirectory()
                    : !stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes)
            ) {
                throw new CollectionError(
                    'UNSAFE_FILE',
                    '通常のファイルだけを扱えます。リンク、特殊ファイル、容量超過を確認してください。',
                );
            }
        }
        if (!isWithin(canonical, realpathSync(path)))
            throw new CollectionError('UNSAFE_PATH', '保存先外のファイルは取得できません。');
        return path;
    } catch (error) {
        if (error instanceof CollectionError) throw error;
        throw new CollectionError('MISSING_FILE', `ファイルが見つかりません: ${name}`, 404);
    }
}

export function readSafe(
    root: string,
    name: string,
    maxBytes = MAX_FILE_BYTES,
    offset = 0,
    length = maxBytes,
) {
    const path = safeFile(root, name, maxBytes);
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes)
            throw new CollectionError('UNSAFE_FILE', '読み取り対象のファイルが変更されています。');
        const size = Math.max(0, Math.min(length, stat.size - offset));
        const buffer = Buffer.alloc(size);
        let read = 0;
        while (read < size) {
            const bytes = readSync(fd, buffer, read, size - read, offset + read);
            if (!bytes) break;
            read += bytes;
        }
        return buffer.subarray(0, read);
    } finally {
        closeSync(fd);
    }
}

export function mimeType(path: string) {
    const extension = path.split('.').pop()?.toLowerCase();
    return (
        (
            {
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                webp: 'image/webp',
                gif: 'image/gif',
                svg: 'image/svg+xml',
                mp4: 'video/mp4',
                webm: 'video/webm',
                tsx: 'text/plain',
                ts: 'text/plain',
                jsx: 'text/plain',
                js: 'text/plain',
                css: 'text/css',
                json: 'application/json',
                md: 'text/plain',
                html: 'text/html',
            } as Record<string, string>
        )[extension ?? ''] ?? 'application/octet-stream'
    );
}

export function rasterType(bytes: Buffer) {
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        return 'image/png';
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
    if (['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'image/gif';
    if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
        return 'image/webp';
    throw new CollectionError(
        'INVALID_IMAGE',
        '参照画像にはPNG・JPEG・WebP・GIFを指定してください。',
    );
}
