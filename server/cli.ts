import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Collection } from './storage.ts';
import { dataDirectory } from './paths.ts';
import { errorInfo } from './errors.ts';

async function main() {
    const [command, argument] = process.argv.slice(2);
    const root = dataDirectory();
    if (command === 'import-samples') {
        const { importSamples } = await import('./samples.ts');
        return importSamples(root);
    }
    if (command === 'register' && argument) {
        const { registerPackage } = await import('./register.ts');
        return registerPackage(argument, root);
    }
    if ((command === 'backup' || command === 'restore') && argument) {
        const { copyCollection } = await import('./backup.ts');
        return command === 'backup'
            ? copyCollection(root, resolve(argument))
            : copyCollection(resolve(argument), root);
    }
    if (command === 'config')
        return {
            mcpServers: {
                formshelf: {
                    command: process.execPath,
                    args: [fileURLToPath(new URL('./mcp.ts', import.meta.url))],
                    env: { FORMSHELF_DATA_DIR: root },
                },
            },
        };
    if (command === 'init' || command === 'doctor') {
        const collection = new Collection(root, command === 'init');
        try {
            if (command === 'init') return { root, initialized: true };
            const result = collection.doctor();
            if (!result.ok) process.exitCode = 1;
            return result;
        } finally {
            collection.close();
        }
    }
    throw new Error(
        '使い方: npm run collection -- init | register <package> | import-samples | doctor | backup <新しい保存先> | restore <バックアップ> | config',
    );
}
main()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
        process.stderr.write(`${JSON.stringify(errorInfo(error))}\n`);
        if (!(error instanceof Error && 'code' in error))
            process.stderr.write(`${error instanceof Error ? error.message : ''}\n`);
        process.exitCode = 1;
    });
