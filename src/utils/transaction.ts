import { PoolClient } from "pg";
import { getConnection } from "./connection";
import { getLogger } from "./logger";
import { HandlerOption } from "../interfaces/HandlerOption";
import { DatabaseError, isDbError } from "../interfaces/DbError";

const logger = getLogger();

/**
 * 트랜잭션 핸들러
 * @param callback 연결을 사용하는 콜백 함수
 * @param option 핸들러 옵션
 * @returns 콜백 함수의 반환값 또는 null (에러 발생 시)
 * @throws {DatabaseError | Error} option.throwError가 true인 경우
 */
export async function handler<T>(
    callback: (connection: PoolClient) => Promise<T>,
    option: HandlerOption = {
        throwError: true,
        printSqlError: true,
        rollbackIfError: true,
        useTransaction: true,
    }
): Promise<T | null> {
    const connection = await getConnection();
    if (connection === null) {
        if (option.throwError) {
            throw new Error("Failed to get database connection");
        }
        return null;
    }

    if (option.useTransaction) {
        try {
            await connection.query("BEGIN");
        } catch (beginError) {
            connection.release();
            if (option.throwError) {
                throw beginError;
            }
            return null;
        }
    }

    try {
        const response = await callback(connection);
        if (option.useTransaction) {
            await connection.query("COMMIT");
        }
        return response;
    } catch (e) {
        if (option.useTransaction && option.rollbackIfError) {
            try {
                await connection.query("ROLLBACK");
            } catch (rollbackError) {
                logger.error("Failed to rollback transaction");
                logger.errorWithStack("Rollback error", rollbackError);
            }
        }

        if (isDbError(e)) {
            if (option.printSqlError) {
                const dbError = e as any;
                logger.error("SQL Error occurred");
                if (dbError.code) {
                    logger.error(`  Code: ${dbError.code}`);
                }
                if (dbError.message) {
                    logger.error(`  Message: ${dbError.message}`);
                }
                if (dbError.detail) {
                    logger.error(`  Detail: ${dbError.detail}`);
                }
                if (dbError.hint) {
                    logger.error(`  Hint: ${dbError.hint}`);
                }
                if (dbError.position) {
                    logger.error(`  Position: ${dbError.position}`);
                }
                if (dbError.severity) {
                    logger.error(`  Severity: ${dbError.severity}`);
                }
                if (dbError.where) {
                    logger.error(`  Where: ${dbError.where}`);
                }
            }
            if (option.throwError) {
                throw new DatabaseError(e);
            }
            return null;
        }

        if (option.throwError) {
            throw e;
        }
        return null;
    } finally {
        // 연결 반환 시 마지막 사용 시간 업데이트 (idleTimeout 관리용)
        (connection as any)._lastUse = Date.now();
        connection.release();
    }
}
