/**
 * 연결 풀 에러 인터페이스
 */
export interface PoolError extends Error {
    code?: string;
    errno?: number;
    syscall?: string;
    address?: string;
    port?: number;
}

/**
 * 연결 풀 에러 클래스
 */
export class ConnectionPoolError extends Error implements PoolError {
    code?: string;
    errno?: number;
    syscall?: string;
    address?: string;
    port?: number;

    constructor(message: string, error?: any) {
        super(message);
        this.name = "ConnectionPoolError";

        if (error) {
            this.code = error.code;
            this.errno = error.errno;
            this.syscall = error.syscall;
            this.address = error.address;
            this.port = error.port;

            if (error.stack) {
                this.stack = error.stack;
            }
        }
    }
}

/**
 * 에러가 풀 에러인지 확인
 */
export function isPoolError(error: any): error is PoolError {
    return (
        error instanceof ConnectionPoolError ||
        (error && typeof error === "object" && "code" in error && typeof error.code === "string")
    );
}
