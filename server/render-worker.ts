import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseManifest } from './manifest.ts';
import { isWithin, MAX_FILE_BYTES, readSafe } from './paths.ts';
import { previewHtml, TOKEN_PLACEHOLDER, withPreviewToken } from './preview-html.ts';

const deadline = Number(process.argv[3]);
if (!process.connected || !Number.isInteger(deadline) || deadline < 1000 || deadline > 120_000)
    throw new Error('登録CLIから起動してください。');
let activeBrowser: Browser | undefined;
const killGroup = () => {
    process.kill(-process.pid, 'SIGKILL');
};
const stop = () => {
    const force = setTimeout(killGroup, 2000);
    if (activeBrowser)
        void activeBrowser.close().finally(() => {
            clearTimeout(force);
            killGroup();
        });
    else killGroup();
};
process.once('disconnect', stop);
const ownDeadline = setTimeout(stop, deadline);

async function main() {
    const stage = realpathSync(process.argv[2]);
    const manifest = parseManifest(
        JSON.parse(readSafe(stage, 'manifest.json', 64 * 1024).toString()),
    );
    const appRoot = fileURLToPath(new URL('../', import.meta.url));
    const nodeModules = realpathSync(join(appRoot, 'node_modules'));
    for (const [name, version] of Object.entries(manifest.dependencies)) {
        const installed = JSON.parse(readFileSync(join(nodeModules, name, 'package.json'), 'utf8'));
        if (installed.version !== version)
            throw new Error(
                `${name}: 指定バージョン ${version} とインストール済み ${installed.version} が異なります。`,
            );
    }
    const listed = new Set(manifest.files.map((file) => join(stage, file)));
    const wrapper = `import React, {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import UI from ${JSON.stringify('./' + manifest.entry)};
const token=${JSON.stringify(TOKEN_PLACEHOLDER)};
const send=(type,message)=>parent.postMessage({type,token,message},'*');
let failed=false;
const fail=(error)=>{failed=true;send('formshelf:error',String(error?.message||error).slice(0,1000));};
addEventListener('error',event=>fail(event.error||event.message));
addEventListener('unhandledrejection',event=>fail(event.reason));
addEventListener('keydown',event=>{if(event.key==='Escape')send('formshelf:close');});
class Boundary extends React.Component{state={failed:false};static getDerivedStateFromError(){return {failed:true}}componentDidCatch(error){fail(error)}render(){return this.state.failed?null:this.props.children}}
function Ready(){useEffect(()=>{let active=true;Promise.all([document.fonts.ready,...Array.from(document.images).map(img=>img.decode().catch(fail))]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(active&&!failed){const root=document.getElementById('root');if(!root.children.length||!root.getBoundingClientRect().height)fail('表示されるUIがありません');else send('formshelf:ready');}})));return()=>{active=false}},[]);return <UI/>}
createRoot(document.getElementById('root')).render(<Boundary><Ready/></Boundary>);`;
    const result = await build({
        stdin: {
            contents: wrapper,
            sourcefile: 'formshelf-wrapper.tsx',
            resolveDir: stage,
            loader: 'tsx',
        },
        bundle: true,
        write: false,
        outfile: join(stage, 'generated/bundle.js'),
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        jsx: 'automatic',
        minify: true,
        define: { 'process.env.NODE_ENV': '"production"' },
        nodePaths: [nodeModules],
        logLevel: 'silent',
        loader: {
            '.png': 'dataurl',
            '.jpg': 'dataurl',
            '.jpeg': 'dataurl',
            '.webp': 'dataurl',
            '.gif': 'dataurl',
            '.svg': 'dataurl',
            '.woff': 'dataurl',
            '.woff2': 'dataurl',
            '.mp4': 'dataurl',
            '.webm': 'dataurl',
        },
        plugins: [
            {
                name: 'collection-files-only',
                setup(builder) {
                    builder.onResolve({ filter: /.*/ }, async (args) => {
                        if (args.pluginData?.checked) return;
                        if (/^(?:https?:|file:|\/)/.test(args.path))
                            throw new Error(`外部パスは使用できません: ${args.path}`);
                        if (args.path.startsWith('data:')) return;
                        const fromPackage = args.importer && isWithin(nodeModules, args.importer);
                        if (!fromPackage && !args.path.startsWith('.')) {
                            const name = args.path.startsWith('@')
                                ? args.path.split('/').slice(0, 2).join('/')
                                : args.path.split('/')[0];
                            if (!Object.hasOwn(manifest.dependencies, name))
                                throw new Error(`依存の宣言がありません: ${name}`);
                        }
                        const resolved = await builder.resolve(args.path, {
                            importer: args.importer,
                            resolveDir: args.resolveDir,
                            kind: args.kind,
                            pluginData: { checked: true },
                        });
                        if (
                            !fromPackage &&
                            args.path.startsWith('.') &&
                            resolved.path &&
                            !listed.has(resolved.path)
                        )
                            throw new Error(`filesに含まれない参照です: ${args.path}`);
                        return resolved;
                    });
                    builder.onLoad({ filter: /.*/ }, (args) => {
                        if (args.namespace !== 'file') return;
                        const canonical = realpathSync(args.path);
                        if (!listed.has(args.path) && !isWithin(nodeModules, canonical))
                            throw new Error(`登録範囲外のファイルです: ${args.path}`);
                        if (listed.has(args.path) && canonical !== args.path)
                            throw new Error('リンクは使用できません。');
                        return undefined;
                    });
                },
            },
        ],
    });
    const script = result.outputFiles.find((file) => extname(file.path) === '.js')?.text;
    if (!script) throw new Error('ビルド結果がありません。');
    const css = result.outputFiles.find((file) => extname(file.path) === '.css')?.text ?? '';
    const html = previewHtml(script, css);
    if (Buffer.byteLength(html) > MAX_FILE_BYTES)
        throw new Error('プレビューは12MiB以内にしてください。');
    const output = join(stage, 'generated');
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, 'preview.html'), html, { flag: 'wx', mode: 0o600 });
    const browser = await chromium.launch({
        headless: true,
        ...(process.env.FORMSHELF_BROWSER_CHANNEL
            ? { channel: process.env.FORMSHELF_BROWSER_CHANNEL }
            : {}),
    });
    activeBrowser = browser;
    try {
        const context = await browser.newContext({
            viewport: { width: 800, height: 600 },
            serviceWorkers: 'block',
        });
        await context.route('**/*', (route) => route.abort());
        const page = await context.newPage();
        const token = randomUUID();
        await page.setContent(
            '<!doctype html><html><body style="margin:0"><iframe title="UI" sandbox="allow-scripts allow-forms" style="display:block;border:0;width:800px;height:600px"></iframe></body></html>',
        );
        await page.evaluate(
            ({ html, token }) => {
                const frame = document.querySelector('iframe')!;
                const state = { ready: false, error: '' };
                Object.assign(window, { captureState: state });
                window.addEventListener('message', (event) => {
                    if (
                        event.source !== frame.contentWindow ||
                        event.origin !== 'null' ||
                        event.data?.token !== token
                    )
                        return;
                    if (event.data.type === 'formshelf:error')
                        state.error = String(event.data.message);
                    if (event.data.type === 'formshelf:ready') state.ready = true;
                });
                frame.srcdoc = html;
            },
            { html: withPreviewToken(html, token), token },
        );
        await page.waitForFunction(
            () => {
                const state = (
                    window as unknown as { captureState: { ready: boolean; error: string } }
                ).captureState;
                return state.ready || state.error;
            },
            undefined,
            { timeout: 25_000 },
        );
        const error = await page.evaluate(
            () => (window as unknown as { captureState: { error: string } }).captureState.error,
        );
        if (error) throw new Error(`描画エラー: ${error}`);
        await page.locator('iframe').screenshot({
            path: join(output, 'thumbnail.png'),
            animations: 'disabled',
            timeout: 10_000,
        });
        const finalError = await page.evaluate(
            () => (window as unknown as { captureState: { error: string } }).captureState.error,
        );
        if (finalError) throw new Error(`描画エラー: ${finalError}`);
    } finally {
        await browser.close();
        activeBrowser = undefined;
    }
}

main()
    .catch((error) => {
        process.stderr.write(
            `${error instanceof Error ? error.message : '登録処理に失敗しました'}\n`,
        );
        process.exitCode = 1;
    })
    .finally(() => {
        clearTimeout(ownDeadline);
        process.off('disconnect', stop);
        if (process.connected) process.disconnect();
    });
