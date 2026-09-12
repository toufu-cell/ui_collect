export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(path, { signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? '読み込みに失敗しました。');
    return result;
}

export async function fileBytes(id: string, path: string, signal?: AbortSignal) {
    let offset: number | null = 0;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (offset !== null) {
        const result: { data: string; nextOffset: number | null } = await api(
            `/api/ui/${id}/file?path=${encodeURIComponent(path)}&offset=${offset}`,
            signal,
        );
        const chunk = Uint8Array.from(atob(result.data), (character) => character.charCodeAt(0));
        chunks.push(chunk);
        size += chunk.length;
        offset = result.nextOffset;
    }
    const bytes = new Uint8Array(size);
    let position = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, position);
        position += chunk.length;
    }
    return bytes;
}
