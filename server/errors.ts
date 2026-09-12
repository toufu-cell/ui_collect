export class CollectionError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 400) {
        super(message);
        this.name = 'CollectionError';
        this.code = code;
        this.status = status;
    }
}

export function errorInfo(error: unknown) {
    if (error instanceof CollectionError) return { code: error.code, message: error.message };
    return {
        code: 'INTERNAL_ERROR',
        message: '処理に失敗しました。保存先の状態を collection doctor で確認してください。',
    };
}
