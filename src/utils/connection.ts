import { Pool, PoolClient } from "pg";
import { getConnectionPool } from "../configs/env";
import { getLogger } from "./logger";
import { ConnectionConfig } from "../interfaces/ConnectionConfig";
import { ConnectionPoolError } from "../interfaces/PoolError";
import { readEnv } from "./reader";

const logger = getLogger();

/**
 * 연결 설정 읽기
 */
let connectionConfig: ConnectionConfig | null = null;

/**
 * 연결 설정을 초기화합니다
 */
export function initConnectionConfig(config?: ConnectionConfig): ConnectionConfig {
    if (connectionConfig && !config) {
        return connectionConfig;
    }

    const defaultConfig: ConnectionConfig = {
        host: readEnv<string>(process.env, "DB_HOST", "127.0.0.1"),
        port: readEnv<number>(process.env, "DB_PORT", 5432),
        user: readEnv<string>(process.env, "DB_USER", "postgres"),
        password: readEnv<string>(process.env, "DB_PASSWORD", "postgres"),
        database: readEnv<string>(process.env, "DB_NAME", "postgres"),
        connectionRetryCount: readEnv<number>(process.env, "DB_CONNECTION_RETRY_COUNT", 3),
        connectionRetryDelay: readEnv<number>(process.env, "DB_CONNECTION_RETRY_DELAY", 1000),
        idleTimeout: readEnv<number>(process.env, "DB_IDLE_TIMEOUT", 60000), // 60초
        reconnect: readEnv<boolean>(process.env, "DB_ENABLE_RECONNECT", true),
        convertDateToUTC: readEnv<boolean>(process.env, "DB_CONVERT_DATE_TO_UTC", true),
        debug: readEnv<boolean>(process.env, "DB_DEBUG", false),
    };

    connectionConfig = config || defaultConfig;
    return connectionConfig;
}

/**
 * 연결을 가져옵니다 (재시도 로직 포함)
 * @returns PostgreSQL 클라이언트 또는 null
 */
export async function getConnection(): Promise<PoolClient | null> {
    const config = initConnectionConfig();
    const pool = getConnectionPool();
    const maxRetries = config.connectionRetryCount || 3;
    const baseDelay = config.connectionRetryDelay || 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const client = await pool.connect();

            // 연결이 살아있는지 확인 (PROTOCOL_CONNECTION_LOST 방지)
            try {
                await client.query("SELECT 1");
            } catch (pingError) {
                // ping 실패 시 연결이 죽은 것이므로 release하고 재시도
                try {
                    client.release();
                } catch (releaseError) {
                    // 무시
                }
                throw new Error("Connection is dead, retrying...");
            }

            // 연결의 마지막 사용 시간 기록 (idleTimeout 관리용)
            (client as any)._lastUse = Date.now();

            return client;
        } catch (e) {
            const isTooManyConnections =
                e instanceof Error &&
                (e.message.includes("too many clients") ||
                    e.message.includes("connection limit") ||
                    (e as any).code === "53300");

            const isConnectionLost =
                e instanceof Error &&
                ((e as any).code === "57P01" || // admin_shutdown
                    (e as any).code === "57P02" || // crash_shutdown
                    (e as any).code === "57P03" || // cannot_connect_now
                    e.message.includes("Connection terminated") ||
                    e.message.includes("Connection is dead") ||
                    e.message.includes("server closed the connection"));

            // 마지막 시도이거나 "Too many connections"/"Connection lost"가 아닌 경우 상세 로그 출력
            if (attempt === maxRetries || (!isTooManyConnections && !isConnectionLost)) {
                logger.error(
                    `Failed to get database connection (attempt ${attempt + 1}/${maxRetries + 1})`
                );

                // 연결 설정 정보 출력 (비밀번호 제외)
                const poolConfig = (pool as any)._options || {};
                logger.error("Connection configuration:");
                logger.error(`  Host: ${poolConfig.host || "unknown"}`);
                logger.error(`  Port: ${poolConfig.port || "unknown"}`);
                logger.error(`  User: ${poolConfig.user || "unknown"}`);
                logger.error(`  Database: ${poolConfig.database || "not specified"}`);
                logger.error(`  Max connections: ${poolConfig.max || "unknown"}`);

                // Pool 상태 정보 (가능한 경우에만)
                try {
                    const poolInternal = pool as any;
                    logger.error("Pool status:");
                    if (poolInternal.totalCount !== undefined) {
                        logger.error(`  Total connections: ${poolInternal.totalCount}`);
                    }
                    if (poolInternal.idleCount !== undefined) {
                        logger.error(`  Idle connections: ${poolInternal.idleCount}`);
                    }
                    if (poolInternal.waitingCount !== undefined) {
                        logger.error(`  Waiting requests: ${poolInternal.waitingCount}`);
                    }
                } catch (statusError) {
                    logger.error("  Unable to retrieve pool status");
                }

                // 에러 상세 정보
                if (e instanceof Error) {
                    logger.error("Error details:");
                    logger.error(`  Message: ${e.message}`);
                    logger.error(`  Stack: ${e.stack}`);

                    // PostgreSQL 에러인 경우 추가 정보
                    const pgError = e as any;
                    if (pgError.code) {
                        logger.error(`  Code: ${pgError.code}`);
                    }
                    if (pgError.severity) {
                        logger.error(`  Severity: ${pgError.severity}`);
                    }
                    if (pgError.detail) {
                        logger.error(`  Detail: ${pgError.detail}`);
                    }
                } else {
                    logger.error(`  Unknown error type: ${typeof e}`);
                    logger.error(`  Error value: ${JSON.stringify(e)}`);
                }
            } else {
                // "Too many connections" 또는 "Connection lost" 에러이고 재시도 가능한 경우
                const delay = baseDelay * Math.pow(2, attempt); // 지수 백오프
                if (isTooManyConnections) {
                    logger.error(
                        `Too many connections detected (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`
                    );
                } else if (isConnectionLost) {
                    logger.error(
                        `Connection lost detected (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`
                    );
                }
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            return null;
        }
    }

    return null;
}

/**
 * Pool의 오래된 커넥션 자동 정리 (주기적으로 실행)
 */
export function startConnectionCleanup(): void {
    const config = initConnectionConfig();
    const pool = getConnectionPool();
    const cleanupInterval = 30000; // 30초마다 체크

    setInterval(() => {
        try {
            const poolInternal = pool as any;
            if (poolInternal._clients && Array.isArray(poolInternal._clients)) {
                const now = Date.now();
                let cleanedCount = 0;
                const idleTimeout = config.idleTimeout || 60000;

                poolInternal._clients.forEach((client: any) => {
                    // 커넥션이 오래되었거나 죽은 경우 정리
                    if (client._ending || client._destroyed) {
                        // 이미 종료되거나 파괴된 경우
                        cleanedCount++;
                    } else if (client._lastUse) {
                        // 마지막 사용 시간이 idleTimeout보다 오래된 경우
                        const idleTime = now - client._lastUse;
                        if (idleTime > idleTimeout) {
                            try {
                                client.release();
                                cleanedCount++;
                            } catch (e) {
                                // 무시
                            }
                        }
                    }
                });

                if (cleanedCount > 0 && config.debug) {
                    logger.debug(`Cleaned up ${cleanedCount} idle connections`);
                }
            }
        } catch (error) {
            // 정리 중 에러 발생 시 무시 (Pool 내부 구조 변경 시 대비)
            if (config.debug) {
                logger.debug("Connection cleanup error (ignored)");
            }
        }
    }, cleanupInterval);
}
