import { PoolClient, QueryResultRow } from "pg";
import { handler } from "../../utils/transaction";
import { HandlerOption } from "../../interfaces/HandlerOption";
import { Logger } from "../../utils/logger";
import { buildWhereClause, extendSelectBuilderWithWhere } from "./where/where";
import { buildLimitClause, buildOffsetClause, extendSelectBuilderWithLimit } from "./limit/limit";
import { buildOrderByClause, extendSelectBuilderWithOrderBy } from "./orderBy/orderBy";

/**
 * SelectBuilder 인터페이스
 */
export interface ISelectBuilder<TEntity extends QueryResultRow = any> {
    /**
     * WHERE 조건 추가
     */
    where(conditions: Record<string, any>): ISelectBuilder<TEntity>;

    /**
     * LIMIT 설정
     */
    limit(count: number): ISelectBuilder<TEntity>;

    /**
     * OFFSET 설정
     */
    offset(count: number): ISelectBuilder<TEntity>;

    /**
     * ORDER BY 설정
     */
    orderBy(column: string, order?: "ASC" | "DESC"): ISelectBuilder<TEntity>;
    /**
     * ORDER BY 설정 (객체 형태)
     */
    orderBy(options: { column: string; order?: "ASC" | "DESC" }): ISelectBuilder<TEntity>;

    /**
     * 쿼리 실행
     */
    execute(options?: HandlerOption): Promise<TEntity[] | null>;
}

/**
 * SelectBuilder 클래스
 */
export class SelectBuilder<TEntity extends QueryResultRow = any> implements ISelectBuilder<TEntity> {
    private tableName: string;
    private logger: Logger;
    private columns: string[] = [];
    private whereConditions: Record<string, any> = {};
    private limitCount?: number;
    private offsetCount?: number;
    private orderByList: { column: string; order: "ASC" | "DESC" }[] = [];

    constructor(tableName: string, logger: Logger, columns?: string[]) {
        this.tableName = tableName;
        this.logger = logger;
        this.columns = columns || [];
    }

    /**
     * WHERE 조건 추가
     */
    where(conditions: Record<string, any>): ISelectBuilder<TEntity> {
        // 기존 조건과 병합
        this.whereConditions = { ...this.whereConditions, ...conditions };
        return this;
    }

    /**
     * LIMIT 설정
     */
    limit(count: number): ISelectBuilder<TEntity> {
        this.limitCount = count;
        return this;
    }

    /**
     * OFFSET 설정
     */
    offset(count: number): ISelectBuilder<TEntity> {
        this.offsetCount = count;
        return this;
    }

    /**
     * ORDER BY 설정
     */
    orderBy(columnOrOptions: string | { column: string; order?: "ASC" | "DESC" }, order?: "ASC" | "DESC"): ISelectBuilder<TEntity> {
        if (typeof columnOrOptions === "string") {
            this.orderByList.push({ column: columnOrOptions, order: order || "ASC" });
        } else {
            this.orderByList.push({ column: columnOrOptions.column, order: columnOrOptions.order || "ASC" });
        }
        return this;
    }

    /**
     * 내부 상태 접근 메서드 (각 모듈에서 사용)
     */
    getWhereConditions(): Record<string, any> {
        return this.whereConditions;
    }

    setWhereConditions(conditions: Record<string, any>): void {
        this.whereConditions = conditions;
    }

    getLimitCount(): number | undefined {
        return this.limitCount;
    }

    setLimitCount(count: number | undefined): void {
        this.limitCount = count;
    }

    getOffsetCount(): number | undefined {
        return this.offsetCount;
    }

    setOffsetCount(count: number | undefined): void {
        this.offsetCount = count;
    }

    getOrderByList(): { column: string; order: "ASC" | "DESC" }[] {
        return this.orderByList;
    }

    setOrderByList(list: { column: string; order: "ASC" | "DESC" }[]): void {
        this.orderByList = list;
    }

    /**
     * 쿼리 실행
     */
    async execute(options?: HandlerOption): Promise<TEntity[] | null> {
        return await handler(
            async (connection: PoolClient) => {
                // SELECT 컬럼
                const selectColumns = this.columns.length > 0 ? this.columns.join(", ") : "*";

                // WHERE 절 (where 모듈 사용)
                const { sql: whereClause, params } = buildWhereClause(this.whereConditions);

                // ORDER BY 절 (orderBy 모듈 사용)
                const orderByClause = buildOrderByClause(this.orderByList);

                // LIMIT 절 (limit 모듈 사용)
                const limitClause = buildLimitClause(this.limitCount);

                // OFFSET 절 (limit 모듈 사용)
                const offsetClause = buildOffsetClause(this.offsetCount);

                // 최종 쿼리 구성
                const queryParts = [
                    `SELECT ${selectColumns}`,
                    `FROM ${this.tableName}`,
                    whereClause,
                    orderByClause,
                    limitClause,
                    offsetClause,
                ].filter((part) => part !== "");

                const query = queryParts.join(" ");

                this.logger.debug(`Executing SELECT: ${query}`, params);

                const result = await connection.query<TEntity>(query, params);
                return result.rows;
            },
            { useTransaction: false, ...options }
        );
    }

}

/**
 * Select 함수 타입
 */
export type SelectFunction<TEntity extends QueryResultRow = any> = (
    columns?: string[]
) => ISelectBuilder<TEntity>;

/**
 * Select 함수를 생성합니다
 */
export function createSelectFunction<TEntity extends QueryResultRow = any>(
    tableName: string,
    logger: Logger
): SelectFunction<TEntity> {
    return function select(columns?: string[]): ISelectBuilder<TEntity> {
        const builder = new SelectBuilder<TEntity>(tableName, logger, columns);
        // 각 모듈의 확장 함수를 체이닝하여 메서드 추가
        return extendSelectBuilderWithOrderBy(
            extendSelectBuilderWithLimit(extendSelectBuilderWithWhere(builder))
        );
    };
}
