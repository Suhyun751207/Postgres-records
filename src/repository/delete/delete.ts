import { PoolClient, QueryResultRow } from "pg";
import { handler } from "../../utils/transaction";
import { HandlerOption } from "../../interfaces/HandlerOption";
import { Logger } from "../../utils/logger";
import { buildWhereClause, WhereInput } from "../select/where/where";

/**
 * DeleteBuilder 인터페이스
 * TEntity: DELETE 시 RETURNING으로 받을 행 타입
 */
export interface IDeleteBuilder<TEntity extends QueryResultRow = any> {
    /**
     * WHERE 절 설정 (객체 또는 ConditionNode)
     */
    where(where: WhereInput): IDeleteBuilder<TEntity>;

    /**
     * RETURNING 절 설정 (기본: 반환 안 함)
     */
    returning(columns?: (keyof TEntity | string)[]): IDeleteBuilder<TEntity>;

    /**
     * 쿼리 실행
     * - returning을 설정한 경우: 삭제된 행 목록 반환
     * - 설정하지 않은 경우: 삭제된 행 수를 number로 반환
     */
    execute(options?: HandlerOption): Promise<TEntity[] | number | null>;
}

/**
 * DeleteBuilder 구현체
 */
export class DeleteBuilder<TEntity extends QueryResultRow = any> implements IDeleteBuilder<TEntity> {
    private tableName: string;
    private logger: Logger;
    private whereInput: WhereInput = null;
    private returningColumns?: string[];

    constructor(tableName: string, logger: Logger) {
        this.tableName = tableName;
        this.logger = logger;
    }

    where(where: WhereInput): IDeleteBuilder<TEntity> {
        this.whereInput = where;
        return this;
    }

    returning(columns?: (keyof TEntity | string)[]): IDeleteBuilder<TEntity> {
        this.returningColumns = columns?.map((c) => String(c));
        return this;
    }

    async execute(options?: HandlerOption): Promise<TEntity[] | number | null> {
        return await handler(
            async (connection: PoolClient) => {
                const { sql: whereSql, params } = buildWhereClause(this.whereInput);

                let query = `DELETE FROM ${this.tableName}`;
                if (whereSql) {
                    query += ` ${whereSql}`;
                }

                const hasReturning = this.returningColumns && this.returningColumns.length > 0;
                if (hasReturning) {
                    query += ` RETURNING ${this.returningColumns!.join(", ")}`;
                }

                this.logger.debug(`Executing DELETE: ${query}`, params);

                const result = await connection.query<TEntity>(query, params);

                if (hasReturning) {
                    return result.rows;
                }

                return result.rowCount ?? 0;
            },
            { useTransaction: true, ...options }
        );
    }
}

/**
 * Delete 함수 타입
 */
export type DeleteFunction<TEntity extends QueryResultRow = any> = () => IDeleteBuilder<TEntity>;

/**
 * Delete 함수를 생성합니다
 */
export function createDeleteFunction<TEntity extends QueryResultRow = any>(
    tableName: string,
    logger: Logger
): DeleteFunction<TEntity> {
    return function del(): IDeleteBuilder<TEntity> {
        return new DeleteBuilder<TEntity>(tableName, logger);
    };
}

