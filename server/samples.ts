import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pieces } from '../src/catalog.ts';
import { registerPackage } from './register.ts';

export async function importSamples(root: string) {
    const appRoot = fileURLToPath(new URL('../', import.meta.url));
    const dependencies = Object.fromEntries(
        ['react', 'react-dom'].map((name) => [
            name,
            JSON.parse(readFileSync(join(appRoot, 'node_modules', name, 'package.json'), 'utf8'))
                .version,
        ]),
    );
    const results = [];
    for (const piece of pieces) {
        const folder = mkdtempSync(join(tmpdir(), 'formshelf-sample-'));
        const {
            title,
            name,
            kind,
            category,
            tags,
            description,
            note,
            interaction,
            color,
            sourceFile,
        } = piece;
        const manifest = {
            schemaVersion: 1,
            title,
            name,
            kind,
            category,
            tags,
            description,
            note,
            interaction,
            color,
            entry: sourceFile,
            files: [sourceFile, 'samples.css', 'reference.png'],
            dependencies,
            source: {
                type: 'sample',
                target: `既存モック ${piece.id} の初期状態。外部サイトの画像ではありません。`,
                reference: 'reference.png',
            },
        };
        writeFileSync(join(folder, 'manifest.json'), JSON.stringify(manifest, null, 4), {
            flag: 'wx',
        });
        for (const file of [sourceFile, 'samples.css'])
            writeFileSync(join(folder, file), readFileSync(join(appRoot, 'src', 'samples', file)), {
                flag: 'wx',
            });
        writeFileSync(
            join(folder, 'reference.png'),
            readFileSync(join(appRoot, 'public', 'thumbnails', `${piece.id}.png`)),
            { flag: 'wx' },
        );
        results.push({ sample: piece.id, ...(await registerPackage(folder, root)) });
        rmSync(folder, { recursive: true });
    }
    return results;
}
