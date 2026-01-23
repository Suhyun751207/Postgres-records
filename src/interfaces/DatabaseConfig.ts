/**
 * PostgreSQL 연결 설정 인터페이스
 * pg 라이브러리의 PoolConfig와 ClientConfig의 모든 옵션을 포함합니다
 */
export interface DatabaseConfig {
    // 기본 연결 설정
    host: string;
    port: number;
    user: string;
    password: string;
    database: string | undefined;
    connectionString?: string;

    // SSL 설정
    ssl?: boolean | object;

    // 연결 풀 설정
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    allowExitOnIdle?: boolean;

    // 타임아웃 설정
    statement_timeout?: number;
    query_timeout?: number;

    // 애플리케이션 설정
    application_name?: string;

    // 날짜 파싱 설정
    parseInputDatesAsUTC?: boolean;

    // Keep-Alive 설정
    keepAlive?: boolean;
    keepAliveInitialDelayMillis?: number;

    // 타입 설정 (커스텀 타입 파서)
    types?: any;
}