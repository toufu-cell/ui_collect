import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { registerPackage } from '../server/register.ts';
import { hash } from '../server/storage.ts';
import type { Piece } from '../shared/types.ts';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const processes = () =>
    execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command='], { encoding: 'utf8' })
        .trim()
        .split('\n')
        .map((line) => {
            const [pid, parent, rss, ...command] = line.trim().split(/\s+/);
            return {
                pid: Number(pid),
                parent: Number(parent),
                rssKiB: Number(rss),
                command: command.join(' '),
            };
        });
function usage(pid: number) {
    const rows = processes();
    const ids = new Set([pid]);
    for (let changed = true; changed;) {
        changed = false;
        for (const row of rows)
            if (ids.has(row.parent) && !ids.has(row.pid)) {
                ids.add(row.pid);
                changed = true;
            }
    }
    const selected = rows.filter((row) => ids.has(row.pid));
    return {
        processes: selected.length,
        rssMiB: Math.round((selected.reduce((sum, row) => sum + row.rssKiB, 0) / 1024) * 10) / 10,
    };
}

test(
    'URL部品とスクショ画面を実MCPで別プロジェクトへ移植し、実データのWebを操作する',
    { timeout: 120_000 },
    async (t) => {
        const work = mkdtempSync(join(tmpdir(), 'formshelf-workflow-'));
        t.after(() => rmSync(work, { recursive: true, force: true }));
        const root = join(work, 'collection');
        const registrations = [];
        for (const name of ['tabs', 'signin']) {
            const source = join(work, name);
            cpSync(join(appRoot, 'examples', name), source, { recursive: true });
            registrations.push(await registerPackage(source, root));
            rmSync(source, { recursive: true });
        }
        const target = join(work, 'another-project');
        mkdirSync(target);
        const client = new Client({ name: 'formshelf-transplant', version: '1.0.0' });
        const transport = new StdioClientTransport({
            command: process.execPath,
            args: [join(appRoot, 'server/mcp.ts')],
            cwd: target,
            env: { ...(process.env as Record<string, string>), FORMSHELF_DATA_DIR: root },
            stderr: 'pipe',
        });
        await client.connect(transport);
        t.after(() => client.close());
        const mcpPid = transport.pid!;
        const measurements: Record<string, unknown> = {
            platform: process.platform,
            node: process.version,
            method: 'ps RSS・所有プロセスと子プロセスの合計。MiB。ブラウザの共有メモリを重複集計する可能性あり。',
            stopped: { processes: 0, rssMiB: 0 },
            mcpIdle: usage(mcpPid),
        };
        for (let count = 0; count < 20; count++)
            await client.callTool({ name: 'search_ui', arguments: { query: '' } });
        const imported: Piece[] = [];
        for (const { id } of registrations) {
            const metadata = await client.callTool({ name: 'get_ui', arguments: { id } });
            const piece = (metadata.structuredContent as { ui: Piece }).ui;
            imported.push(piece);
            const folder = join(target, id);
            mkdirSync(folder);
            for (const file of piece.files.filter((file) => !file.path.startsWith('generated/'))) {
                let offset: number | null = 0;
                const chunks: Buffer[] = [];
                while (offset !== null) {
                    const response = await client.callTool({
                        name: 'read_ui_file',
                        arguments: { id, path: file.path, offset },
                    });
                    const result = response.structuredContent as {
                        data: string;
                        nextOffset: number | null;
                    };
                    chunks.push(Buffer.from(result.data, 'base64'));
                    offset = result.nextOffset;
                }
                const bytes = Buffer.concat(chunks);
                assert.equal(hash(bytes), file.sha256);
                mkdirSync(dirname(join(folder, file.path)), { recursive: true });
                writeFileSync(join(folder, file.path), bytes);
            }
        }
        assert.deepEqual(
            imported.map((piece) => piece.source.type),
            ['url', 'screenshot'],
        );
        assert.deepEqual(
            imported.map((piece) => piece.kind),
            ['component', 'screen'],
        );
        measurements.mcpAfterReads = usage(mcpPid);
        assert.equal(usage(mcpPid).processes, 1, 'MCP does not spawn build/browser processes');
        await client.close();
        assert.equal(usage(mcpPid).processes, 0);
        const compiled = await build({
            stdin: {
                contents: `import React from 'react';import {createRoot} from 'react-dom/client';${imported.map((piece, index) => `import UI${index} from './${piece.id}/${piece.entry}';`).join('')}createRoot(document.getElementById('target')).render(<><h1 id="host-title">移植先の見出し</h1><UI0/><UI1/></>);`,
                resolveDir: target,
                sourcefile: 'App.tsx',
                loader: 'tsx',
            },
            bundle: true,
            write: false,
            outfile: join(target, 'app.js'),
            platform: 'browser',
            jsx: 'automatic',
            nodePaths: [join(appRoot, 'node_modules')],
            define: { 'process.env.NODE_ENV': '"production"' },
        });
        const js = compiled.outputFiles.find((file) => file.path.endsWith('.js'))!.text;
        const css = compiled.outputFiles.find((file) => file.path.endsWith('.css'))!.text;
        const browser = await chromium.launch();
        t.after(() => browser.close());
        const browserPid = processes().find(
            (row) => row.parent === process.pid && row.command.includes('chrome-headless-shell'),
        )!.pid;
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await page.setContent(
            `<style>body{margin:0}#host-title{font-size:30px;color:rgb(151, 22, 40)}${css}</style><div id="target"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`,
        );
        await page.getByRole('tab', { name: '概要', exact: true }).press('ArrowRight');
        assert.equal(
            await page
                .getByRole('tab', { name: '分析', exact: true })
                .getAttribute('aria-selected'),
            'true',
        );
        assert.match(await page.getByRole('tabpanel').innerText(), /24件/);
        await page.getByLabel('メールアドレス', { exact: true }).fill('person@example.com');
        await page.getByRole('button', { name: 'ログインリンクを送信' }).click();
        assert.match(await page.getByRole('status').innerText(), /入力を確認しました/);
        assert.equal(
            await page
                .locator('#host-title')
                .evaluate((element) => getComputedStyle(element).color),
            'rgb(151, 22, 40)',
        );
        assert.equal(
            await page
                .locator('#host-title')
                .evaluate((element) => getComputedStyle(element).fontSize),
            '30px',
        );
        mkdirSync(join(appRoot, 'artifacts'), { recursive: true });
        await page.screenshot({
            path: join(appRoot, 'artifacts/transplant-desktop.png'),
            fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.locator('.fs-signin-art').isVisible(), false);
        assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
        );
        await page.screenshot({
            path: join(appRoot, 'artifacts/transplant-mobile.png'),
            fullPage: true,
        });

        const reserve = createServer();
        await new Promise<void>((resolve) => reserve.listen(0, '127.0.0.1', resolve));
        const port = (reserve.address() as { port: number }).port;
        await new Promise<void>((resolve) => reserve.close(() => resolve()));
        const web = spawn(process.execPath, [join(appRoot, 'server/web.ts')], {
            env: { ...process.env, FORMSHELF_DATA_DIR: root, PORT: String(port) },
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        t.after(() => web.kill());
        await new Promise<void>((resolve, reject) => {
            web.stderr.on('data', (data) => {
                if (String(data).includes('Formshelf:')) resolve();
            });
            web.once('error', reject);
            web.once('exit', (code) => reject(new Error(`Web exited ${code}`)));
        });
        const base = `http://127.0.0.1:${port}`;
        await page.setViewportSize({ width: 1440, height: 1000 });
        const requests: string[] = [];
        page.on('request', (request) => requests.push(request.url()));
        await page.goto(base);
        await page
            .getByRole('button', { name: `${imported[0].title}を開く`, exact: true })
            .waitFor();
        assert.equal(await page.locator('iframe').count(), 0);
        assert.ok(
            !requests.some((url) => /\/preview|\/file\?/.test(url)),
            'list does not load source or execute previews',
        );
        measurements.webList = { server: usage(web.pid!), browser: usage(browserPid) };
        await page.screenshot({
            path: join(appRoot, 'artifacts/collection-desktop.png'),
            fullPage: true,
        });
        await page.getByRole('button', { name: `${imported[0].title}を開く`, exact: true }).click();
        await page.frameLocator('iframe').getByRole('tab', { name: '分析', exact: true }).click();
        assert.match(await page.frameLocator('iframe').getByRole('tabpanel').innerText(), /24件/);
        assert.equal(await page.locator('iframe').count(), 1);
        assert.equal(
            await page.locator('iframe').getAttribute('sandbox'),
            'allow-scripts allow-forms',
        );
        measurements.webPreview = { server: usage(web.pid!), browser: usage(browserPid) };
        await page.getByRole('button', { name: '参照画像', exact: true }).click();
        assert.equal(await page.locator('iframe').count(), 0);
        await page.getByAltText(`${imported[0].title}の参照画像`).waitFor();
        await page.getByRole('button', { name: 'コード', exact: true }).click();
        await page.getByLabel('表示するファイル').selectOption('0');
        await page.getByRole('code').filter({ hasText: 'function Tabs' }).waitFor();
        await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
        await page
            .frameLocator('iframe')
            .getByRole('tab', { name: '概要', exact: true })
            .press('Escape');
        await page.locator('dialog').waitFor({ state: 'detached' });
        assert.equal(await page.locator('iframe').count(), 0);
        assert.equal(
            await page
                .getByRole('button', { name: `${imported[0].title}を開く`, exact: true })
                .evaluate((element) => element === document.activeElement),
            true,
        );
        measurements.webClosedDetail = { server: usage(web.pid!), browser: usage(browserPid) };
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: `${imported[1].title}を開く`, exact: true }).click();
        const formFrame = page.frameLocator('iframe');
        for (const value of ['', 'invalid-email']) {
            await formFrame.getByLabel('メールアドレス').fill(value);
            await formFrame.getByRole('button', { name: 'ログインリンクを送信' }).click();
            assert.doesNotMatch(
                await formFrame.getByRole('status').innerText(),
                /入力を確認しました/,
            );
            assert.equal(
                await formFrame
                    .getByLabel('メールアドレス')
                    .evaluate((element) => (element as HTMLInputElement).validity.valid),
                false,
            );
        }
        await formFrame.getByLabel('メールアドレス').fill('mobile@example.com');
        await formFrame.getByRole('button', { name: 'ログインリンクを送信' }).click();
        assert.match(await formFrame.getByRole('status').innerText(), /入力を確認しました/);
        await page.screenshot({
            path: join(appRoot, 'artifacts/collection-mobile.png'),
            fullPage: true,
        });
        assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
        );
        assert.deepEqual(pageErrors, []);
        await browser.close();
        const stopped = new Promise<void>((resolve) => web.once('close', () => resolve()));
        web.kill();
        await stopped;
        assert.equal(usage(web.pid!).processes, 0);
        assert.equal(usage(browserPid).processes, 0);
        measurements.afterStop = {
            mcp: usage(mcpPid),
            server: usage(web.pid!),
            browser: usage(browserPid),
        };
        writeFileSync(
            join(appRoot, 'artifacts/memory.json'),
            JSON.stringify(measurements, null, 2),
        );
        assert.ok(readFileSync(join(target, registrations[0].id, 'reference.png')).length);
    },
);
