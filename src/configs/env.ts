import dotenv from "dotenv";
import { Pool, PoolConfig } from "pg";
import { DatabaseConfig } from "../interfaces";
import { getLogger } from "../utils";
import { readEnv } from "../utils/reader";
import { startConnectionCleanup } from "../utils/connection";

// 환경 변수 로드
dotenv.config();

/**
 * 환경 변수에서 데이터베이스 설정을 읽어옵니다
 * PostgreSQL의 모든 설정 옵션을 환경 변수에서 읽어옵니다
 */
export function getDatabaseConfig(): DatabaseConfig {
    const env = process.env;
    const config: DatabaseConfig = {
        // 기본 연결 설정
        host: readEnv<string>(env, "DB_HOST", "127.0.0.1"),
        port: readEnv<number>(env, "DB_PORT", 5432),
        database: env.DB_NAME,
        user: readEnv<string>(env, "DB_USER", "postgres"),
        password: readEnv<string>(env, "DB_PASSWORD", "postgres"),
        connectionString: env.DB_CONNECTION_STRING,

        // SSL 설정
        ssl: readEnv<boolean>(env, "DB_SSL", false) || undefined,

        // 연결 풀 설정
        max: env.DB_MAX ? readEnv<number>(env, "DB_MAX", 20) : undefined,
        idleTimeoutMillis: env.DB_IDLE_TIMEOUT ? readEnv<number>(env, "DB_IDLE_TIMEOUT", 30000) : undefined,
        connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT
            ? readEnv<number>(env, "DB_CONNECTION_TIMEOUT", 2000)
            : undefined,
        allowExitOnIdle: readEnv<boolean>(env, "DB_ALLOW_EXIT_ON_IDLE", false) || undefined,

        // 타임아웃 설정
        statement_timeout: env.DB_STATEMENT_TIMEOUT
            ? readEnv<number>(env, "DB_STATEMENT_TIMEOUT", 0)
            : undefined,
        query_timeout: env.DB_QUERY_TIMEOUT ? readEnv<number>(env, "DB_QUERY_TIMEOUT", 0) : undefined,

        // 애플리케이션 설정
        application_name: env.DB_APPLICATION_NAME,

        // 날짜 파싱 설정
        parseInputDatesAsUTC: readEnv<boolean>(env, "DB_PARSE_INPUT_DATES_AS_UTC", false) || undefined,

        // Keep-Alive 설정
        keepAlive: readEnv<boolean>(env, "DB_KEEP_ALIVE", true) || undefined,
        keepAliveInitialDelayMillis: env.DB_KEEP_ALIVE_INITIAL_DELAY
            ? readEnv<number>(env, "DB_KEEP_ALIVE_INITIAL_DELAY", 10000)
            : undefined,
    };

    return config;
}

/**
 * PostgreSQL 연결 풀 인스턴스
 */
let pool: Pool | null = null;

/**
 * 데이터베이스 연결 풀을 생성하고 반환합니다
 * @param config 선택적 데이터베이스 설정 (없으면 환경 변수에서 읽어옴)
 * @returns PostgreSQL 연결 풀 인스턴스
 */
export function createConnectionPool(config?: DatabaseConfig): Pool {
    if (pool) {
        return pool;
    }

    const dbConfig = config || getDatabaseConfig();

    // 필수 설정 검증
    if (!dbConfig.database || !dbConfig.user) {
        throw new Error(
            "Database configuration is incomplete. Please set DB_NAME and DB_USER environment variables."
        );
    }

    const poolConfig: PoolConfig = {
        // 기본 연결 설정
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        connectionString: dbConfig.connectionString,

        // SSL 설정
        ssl: dbConfig.ssl,

        // 연결 풀 설정
        max: dbConfig.max || 20,
        idleTimeoutMillis: dbConfig.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: dbConfig.connectionTimeoutMillis || 2000,
        allowExitOnIdle: dbConfig.allowExitOnIdle,

        // 타임아웃 설정
        statement_timeout: dbConfig.statement_timeout,
        query_timeout: dbConfig.query_timeout,

        // 애플리케이션 설정
        application_name: dbConfig.application_name,

        // Keep-Alive 설정
        keepAlive: dbConfig.keepAlive,
        keepAliveInitialDelayMillis: dbConfig.keepAliveInitialDelayMillis,

        // 타입 설정
        types: dbConfig.types,
    } as PoolConfig;

    pool = new Pool(poolConfig);

    // 에러 핸들링
    const logger = getLogger();
    pool.on("error", (err) => {
        logger.error("Pool error occurred");
        logger.errorWithStack("Unexpected error on idle client", err);
        if ((err as any).code) {
            logger.error(`Error code: ${(err as any).code}`);
        }
        if ((err as any).severity) {
            logger.error(`Severity: ${(err as any).severity}`);
        }
    });

    // 연결 정리 시작
    startConnectionCleanup();

    return pool;
}

/**
 * 현재 연결 풀을 반환합니다. 없으면 생성합니다
 */
export function getConnectionPool(): Pool {
    if (!pool) {
        return createConnectionPool();
    }
    return pool;
}

/**
 * 데이터베이스 연결을 테스트합니다
 * @returns 연결 성공 여부
 */
export async function testConnection(): Promise<boolean> {
    try {
        const pool = getConnectionPool();
        const client = await pool.connect();

        const result = await client.query("SELECT NOW()");
        client.release();

        const logger = getLogger({ prefix: "DB" });
        logger.info("Database connection successful. Server time:", result.rows[0].now);
        return true;
    } catch (error) {
        const logger = getLogger({ prefix: "DB" });
        logger.errorWithStack("Database connection failed", error);
        return false;
    }
}

/**
 * 데이터베이스 연결 풀을 종료합니다
 */
export async function closeConnectionPool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        const logger = getLogger({ prefix: "DB" });
        logger.info("Database connection pool closed");
    }
}

/**
 * 연결 풀에서 클라이언트를 가져옵니다
 * @deprecated Use getConnection from utils/connection instead
 * @returns PostgreSQL 클라이언트
 */
export async function getClient() {
    const { getConnection } = await import("../utils/connection");
    return await getConnection();
}