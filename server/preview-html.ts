export const PREVIEW_CSP =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export const TOKEN_PLACEHOLDER = '__FORMSHELF_PREVIEW_TOKEN__';
export function previewHtml(script: string, css: string) {
    return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;min-height:100%;font-family:system-ui,sans-serif}*{box-sizing:border-box}${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}
export function withPreviewToken(html: string, token: string) {
    if (!/^[a-f0-9-]{36}$/.test(token)) throw new Error('Invalid preview token');
    return html.replaceAll(TOKEN_PLACEHOLDER, token);
}
