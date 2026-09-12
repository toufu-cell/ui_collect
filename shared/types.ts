export type Source = {
    type: 'screenshot' | 'url' | 'recording' | 'sample';
    url?: string;
    target: string;
    reference: string;
};

export type Manifest = {
    schemaVersion: 1;
    title: string;
    name: string;
    kind: 'component' | 'screen';
    category: string;
    tags: string[];
    description: string;
    note: string;
    interaction: string;
    color: string;
    entry: string;
    files: string[];
    dependencies: Record<string, string>;
    source: Source;
};

export type FileInfo = {
    path: string;
    size: number;
    sha256: string;
    mime: string;
};

export type Piece = Omit<Manifest, 'files'> & {
    id: string;
    createdAt: string;
    fingerprint: string;
    files: FileInfo[];
};

export type SearchInput = {
    query?: string;
    kind?: 'all' | 'component' | 'screen';
    category?: string;
    sort?: 'catalog' | 'reverse' | 'name';
    offset?: number;
    limit?: number;
};

export type SearchResult = {
    items: Piece[];
    total: number;
    stats: { total: number; component: number; screen: number };
    categories: string[];
};
