import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
    cpSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, request } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Collection, hash } from '../server/storage.ts';
import { registerPackage } from '../server/register.ts';
import { copyCollection } from '../server/backup.ts';
import { guard, handleApi } from '../server/http.ts';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const fixture = (t: TestContext) => {
    const work = mkdtempSync(join(tmpdir(), 'formshelf-test-'));
    t.after(() => rmSync(work, { recursive: true, force: true }));
    const source = join(work, 'source');
    cpSync(join(appRoot, 'examples/tabs'), source, { recursive: true });
    return { work, source, root: join(work, 'data') };
};
function changeSource(source: string, code: string) {
    writeFileSync(join(source, 'Tabs.tsx'), code);
}

test('完成した登録だけを永続化し、再実行・同時登録でIDを重複させない', async (t) => {
    const { source, root } = fixture(t);
    const [first, concurrent] = await Promise.all([
        registerPackage(source, root),
        registerPackage(source, root),
    ]);
    assert.equal(first.id, concurrent.id);
    assert.equal((await registerPackage(source, root)).id, first.id);
    rmSync(source, { recursive: true });
    const db = new Collection(root);
    t.after(() => db.close());
    const result = db.search({ query: 'タブ キーボード', kind: 'component' });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].id, first.id);
    assert.ok(db.bytes(first.id, 'generated/thumbnail.png').length > 1000);
    assert.match(db.bytes(first.id, 'Tabs.tsx').toString(), /function Tabs/);
    assert.equal(db.search({ query: "' OR 1=1 --" }).total, 0);
    assert.throws(() => db.search({ limit: 51 }), /取得件数/);
    assert.throws(() => db.get('../collection.sqlite'), /ID/);
    assert.throws(() => db.readFile(first.id, '../collection.sqlite'), /登録済みファイル/);
    assert.throws(() => db.readFile(first.id, 'Tabs.tsx', -1), /取得範囲/);
    const part = db.readFile(first.id, 'Tabs.tsx', 0, 32);
    assert.equal(Buffer.from(part.data, 'base64').length, 32);
    assert.equal(part.nextOffset, 32);
});

test('入力のリンク・宣言漏れ・描画例外を拒否し、既存UIを保持する', async (t) => {
    const { source, root, work } = fixture(t);
    const good = await registerPackage(source, root);
    const db = new Collection(root);
    t.after(() => db.close());
    const original = readFileSync(join(source, 'Tabs.tsx'));
    rmSync(join(source, 'Tabs.tsx'));
    writeFileSync(join(work, 'outside.tsx'), original);
    symlinkSync(join(work, 'outside.tsx'), join(source, 'Tabs.tsx'));
    await assert.rejects(registerPackage(source, root), /リンク/);
    rmSync(join(source, 'Tabs.tsx'));
    changeSource(source, "import './missing.css'; export default function UI(){return <p>UI</p>}");
    await assert.rejects(registerPackage(source, root), /プレビューを作成できません/);
    changeSource(source, "export default function UI(){throw new Error('expected-render-error')}");
    await assert.rejects(registerPackage(source, root), /expected-render-error/);
    assert.equal(db.search().total, 1);
    assert.equal(db.get(good.id).id, good.id);
    assert.ok(db.doctor().issues.some((issue) => issue.includes('未完了')));
});

test('取得時に改変・リンクへの差し替えを検出する', async (t) => {
    const { source, root, work } = fixture(t);
    const { id } = await registerPackage(source, root);
    const db = new Collection(root);
    t.after(() => db.close());
    const path = join(db.objectRoot(id), 'Tabs.tsx');
    const original = readFileSync(path);
    writeFileSync(path, 'modified');
    assert.throws(() => db.bytes(id, 'Tabs.tsx'), /破損/);
    rmSync(path);
    writeFileSync(join(work, 'outside'), original);
    symlinkSync(join(work, 'outside'), path);
    assert.throws(() => db.bytes(id, 'Tabs.tsx'), /リンク/);
    renameSync(join(root, 'objects'), join(root, 'objects-real'));
    symlinkSync(join(root, 'objects-real'), join(root, 'objects'));
    assert.throws(() => db.bytes(id, 'Tabs.tsx'), /ディレクトリ/);
});

test('バックアップと復元がコード・画像を保持し、既存のコピー先を上書きしない', async (t) => {
    const { source, root, work } = fixture(t);
    const { id } = await registerPackage(source, root);
    const backup = join(work, 'backup');
    const restored = join(work, 'restored');
    await copyCollection(root, backup);
    await copyCollection(backup, restored);
    const db = new Collection(restored);
    t.after(() => db.close());
    assert.equal(db.search().total, 1);
    assert.equal(
        db.bytes(id, 'Tabs.tsx').toString(),
        readFileSync(join(source, 'Tabs.tsx'), 'utf8'),
    );
    assert.equal(db.doctor().ok, true);
    await assert.rejects(copyCollection(root, restored), /既にあります/);
    assert.equal(db.search().total, 1);
    rmSync(join(root, 'objects', id, 'reference.png'));
    const incomplete = join(work, 'incomplete');
    await assert.rejects(copyCollection(root, incomplete), /見つかりません/);
    assert.throws(() => new Collection(incomplete), /未作成/);
    assert.ok(db.bytes(id, 'reference.png').length);
});

test('実MCPが別の作業ディレクトリからWebなしで検索・分割取得し、切断できる', async (t) => {
    const { source, root, work } = fixture(t);
    const { id } = await registerPackage(source, root);
    const client = new Client({ name: 'formshelf-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(appRoot, 'server/mcp.ts')],
        cwd: work,
        env: { ...(process.env as Record<string, string>), FORMSHELF_DATA_DIR: root },
        stderr: 'pipe',
    });
    await client.connect(transport);
    t.after(() => client.close());
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
        'get_ui',
        'read_ui_file',
        'search_ui',
    ]);
    assert.ok(listed.tools.every((tool) => tool.annotations?.readOnlyHint));
    const search = await client.callTool({ name: 'search_ui', arguments: { query: 'タブ' } });
    assert.match(JSON.stringify(search), new RegExp(id));
    const get = await client.callTool({ name: 'get_ui', arguments: { id } });
    assert.match(JSON.stringify(get), /react-dom/);
    const duringRead = registerPackage(source, root);
    const concurrentReads = await Promise.all(
        Array.from({ length: 5 }, () => client.callTool({ name: 'get_ui', arguments: { id } })),
    );
    assert.ok(
        concurrentReads.every((result) => !result.isError && JSON.stringify(result).includes(id)),
    );
    assert.equal((await duringRead).id, id);
    const chunks: Buffer[] = [];
    let offset: number | null = 0;
    let checksum = '';
    while (offset !== null) {
        const response = await client.callTool({
            name: 'read_ui_file',
            arguments: { id, path: 'reference.png', offset, length: 1024 },
        });
        const result = response.structuredContent as {
            data: string;
            nextOffset: number | null;
            sha256: string;
        };
        chunks.push(Buffer.from(result.data, 'base64'));
        offset = result.nextOffset;
        checksum = result.sha256;
    }
    assert.equal(hash(Buffer.concat(chunks)), checksum);
    assert.deepEqual(Buffer.concat(chunks), readFileSync(join(source, 'reference.png')));
    const bad = await client.callTool({
        name: 'read_ui_file',
        arguments: { id, path: '/etc/passwd' },
    });
    assert.equal(bad.isError, true);
    await client.close();
});

test('撮影時に外部通信せず、直接API表示でも未信頼HTMLを実行形式で配信しない', async (t) => {
    const { source, root } = fixture(t);
    let hits = 0;
    const listener = createServer((_req, res) => {
        hits++;
        res.end('secret');
    });
    await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
    t.after(() => listener.close());
    const networkPort = (listener.address() as { port: number }).port;
    changeSource(
        source,
        `import {useEffect} from 'react'; export default function UI(){useEffect(()=>{fetch('http://127.0.0.1:${networkPort}/').catch(()=>{});try{parent.document.body.textContent='escaped'}catch{}},[]);return <div><form action="http://127.0.0.1:${networkPort}/post" method="post"><input name="sample" defaultValue="demo"/><button>送信</button></form><button onClick={()=>{location.href='http://127.0.0.1:${networkPort}/navigation'}}>移動</button></div>}`,
    );
    const { id } = await registerPackage(source, root);
    assert.equal(hits, 0);
    const web = createServer((request, response) => {
        if (!guard(request, response, port) || handleApi(request, response, root)) return;
        response.setHeader('Content-Type', 'text/html');
        response.end('<h1>parent</h1><iframe sandbox="allow-scripts allow-forms"></iframe>');
    });
    await new Promise<void>((resolve) => web.listen(0, '127.0.0.1', resolve));
    const port = (web.address() as { port: number }).port;
    t.after(() => {
        web.close();
        web.closeAllConnections();
    });
    const base = `http://127.0.0.1:${port}`;
    const preview = await fetch(`${base}/api/ui/${id}/preview`);
    assert.match(preview.headers.get('content-type')!, /application\/json/);
    assert.equal(preview.headers.get('x-content-type-options'), 'nosniff');
    const data = await preview.json();
    assert.match(data.html, /connect-src 'none'/);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(base);
    await page.evaluate((html) => {
        document.querySelector('iframe')!.srcdoc = html;
    }, data.html);
    await page.frameLocator('iframe').getByRole('button', { name: '移動' }).waitFor();
    assert.equal(await page.locator('h1').innerText(), 'parent');
    const formBlocked = page.waitForEvent('console', (message) =>
        message.text().includes('form-action'),
    );
    await page.frameLocator('iframe').getByRole('button', { name: '送信', exact: true }).click();
    await formBlocked;
    assert.equal(hits, 0, 'native form POST must not reach the listener');
    // A blocked form navigation can replace the frame with a browser error page.
    await page.goto(base);
    await page.evaluate((html) => {
        document.querySelector('iframe')!.srcdoc = html;
    }, data.html);
    await page.frameLocator('iframe').getByRole('button', { name: '移動' }).waitFor();
    const navigatedOrBlocked = Promise.race([
        page.waitForEvent('framenavigated', (frame) => frame.parentFrame() !== null),
        page.waitForEvent('console', (message) => message.text().includes('frame-src')),
    ]);
    await page.frameLocator('iframe').getByRole('button', { name: '移動' }).click();
    await navigatedOrBlocked;
    assert.equal(hits, 0, 'preview self-navigation must not reach the listener');
    const raw = await fetch(`${base}/api/ui/${id}/file?path=generated/preview.html`);
    assert.match(raw.headers.get('content-type')!, /application\/json/);
    for (const headers of [
        { host: 'evil.example' },
        { origin: 'https://evil.example' },
        { 'sec-fetch-site': 'cross-site' },
    ] as Record<string, string>[]) {
        const status = await new Promise<number | undefined>((resolve, reject) => {
            const req = request(`${base}/api/ui`, { headers }, (response) => {
                response.resume();
                resolve(response.statusCode);
            });
            req.on('error', reject);
            req.end();
        });
        assert.equal(status, 403, JSON.stringify(headers));
    }
    assert.equal((await fetch(`${base}/api/ui`, { method: 'POST' })).status, 405);
});

test(
    '親の登録CLIが強制終了してもworkerと撮影ブラウザが残らない',
    { timeout: 20_000 },
    async (t) => {
        const { source, root } = fixture(t);
        changeSource(source, 'export default function UI(){while(true){} return <p>never</p>}');
        const parent = spawn(
            process.execPath,
            [join(appRoot, 'server/cli.ts'), 'register', source],
            { env: { ...process.env, FORMSHELF_DATA_DIR: root }, stdio: 'ignore' },
        );
        const groups = new Set<number>();
        t.after(() => {
            parent.kill('SIGKILL');
            for (const group of groups) {
                try {
                    process.kill(-group, 'SIGKILL');
                } catch {}
            }
        });
        const rows = () =>
            execFileSync('ps', ['-axo', 'pid=,ppid=,pgid=,command='], { encoding: 'utf8' })
                .split('\n')
                .map((line) => {
                    const [pid, parent, pgid, ...command] = line.trim().split(/\s+/);
                    return {
                        pid: Number(pid),
                        parent: Number(parent),
                        group: Number(pgid),
                        command: command.join(' '),
                    };
                });
        async function until(predicate: () => boolean, timeout: number) {
            const end = Date.now() + timeout;
            while (!predicate()) {
                if (Date.now() > end) assert.fail('process condition timed out');
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
        }
        await until(() => {
            const processes = rows();
            const worker = processes.find(
                (row) =>
                    row.command.includes('render-worker.ts') &&
                    row.command.includes(root.split('/').slice(-2).join('/')),
            );
            if (!worker) return false;
            groups.add(worker.group);
            const browser = processes.find(
                (row) => row.parent === worker.pid && row.command.includes('chrome-headless-shell'),
            );
            if (browser) groups.add(browser.group);
            return Boolean(browser);
        }, 10_000);
        const exited = new Promise<void>((resolve) => parent.once('close', () => resolve()));
        parent.kill('SIGKILL');
        await exited;
        await until(() => !rows().some((row) => groups.has(row.group)), 3000);
        const db = new Collection(root);
        t.after(() => db.close());
        assert.equal(db.search().total, 0);
    },
);

test('無限ループの期限切れで未完成UIを公開せず、撮影プロセス群を終了する', async (t) => {
    const { source, root } = fixture(t);
    changeSource(source, 'export default function UI(){while(true){} return <p>never</p>}');
    const pending = registerPackage(source, root, 4000);
    const stage = readdirSync(join(root, 'staging'))[0];
    const processes = () =>
        execFileSync('ps', ['-axo', 'pid=,pgid=,command='], { encoding: 'utf8' });
    const line = processes()
        .split('\n')
        .find((line) => line.includes('render-worker.ts') && line.includes(stage));
    assert.ok(line, 'worker process is running');
    const group = line.trim().split(/\s+/)[1];
    await assert.rejects(pending, /期限内/);
    const remaining = processes()
        .split('\n')
        .filter((line) => line.trim().split(/\s+/)[1] === group);
    assert.deepEqual(remaining, []);
    const db = new Collection(root);
    t.after(() => db.close());
    assert.equal(db.search().total, 0);
});
