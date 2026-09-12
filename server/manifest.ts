import { z } from 'zod';
import { CollectionError } from './errors.ts';
import { MAX_FILES, relativeFile } from './paths.ts';
import type { Manifest } from '../shared/types.ts';

const pathSchema = z
    .string()
    .max(260)
    .refine((value) => {
        try {
            relativeFile(value);
            return !value.startsWith('generated/');
        } catch {
            return false;
        }
    }, '通常の相対パスを指定してください。generated/ は予約領域です。');
const text = (max: number) => z.string().trim().min(1).max(max);
const schema = z
    .object({
        schemaVersion: z.literal(1),
        title: text(100),
        name: text(100),
        kind: z.enum(['component', 'screen']),
        category: text(40),
        tags: z.array(text(40)).max(20),
        description: text(2000),
        note: z.string().max(2000).default(''),
        interaction: z.string().max(2000).default(''),
        color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .default('#f7f8fa'),
        entry: pathSchema,
        files: z.array(pathSchema).min(2).max(MAX_FILES),
        dependencies: z
            .record(
                z.string().regex(/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/),
                z.string().regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/),
            )
            .refine((value) => Object.keys(value).length <= 30),
        source: z
            .object({
                type: z.enum(['screenshot', 'url', 'recording', 'sample']),
                url: z.string().url().max(2048).optional(),
                target: text(1000),
                reference: pathSchema,
            })
            .strict(),
    })
    .strict();

export function parseManifest(input: unknown): Manifest {
    const result = schema.safeParse(input);
    if (!result.success)
        throw new CollectionError(
            'INVALID_MANIFEST',
            `manifest.json を確認してください: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
        );
    const manifest = result.data;
    if (
        new Set(manifest.files).size !== manifest.files.length ||
        !manifest.files.includes(manifest.entry) ||
        !manifest.files.includes(manifest.source.reference) ||
        !/\.(tsx|jsx)$/.test(manifest.entry)
    )
        throw new CollectionError(
            'INVALID_MANIFEST',
            'files には入口のTSX/JSXと参照画像を重複なく含めてください。',
        );
    if (
        manifest.files.some(
            (file) =>
                file === 'manifest.json' ||
                file.startsWith('node_modules/') ||
                file.split('/').some((part) => part.startsWith('.')),
        )
    )
        throw new CollectionError(
            'INVALID_MANIFEST',
            'manifest.json・隠しファイル・node_modules はfilesに含められません。',
        );
    if (manifest.source.type === 'url' && !manifest.source.url)
        throw new CollectionError('INVALID_SOURCE', 'URL起点では元URLと対象部分が必要です。');
    if (manifest.source.url) {
        const url = new URL(manifest.source.url);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
            throw new CollectionError(
                'INVALID_SOURCE',
                '認証情報を含まないHTTP(S)の元URLを指定してください。',
            );
    }
    if (!manifest.dependencies.react || !manifest.dependencies['react-dom'])
        throw new CollectionError(
            'INVALID_MANIFEST',
            'dependenciesにはReactとReactDOMの正確なバージョンが必要です。',
        );
    return manifest;
}
