import { PoolClient, QueryResultRow } from "pg";
import { handler } from "../../utils/transaction";
import { HandlerOption } from "../../interfaces/HandlerOption";
import { Logger } from "../../utils/logger";
import { buildWhereClause, WhereInput } from "../select/where/where";

/**
 * UpdateBuilder 인터페이스
 * TEntity: UPDATE 후 반환 받을 행 타입 (DB row)
 * TUpdate: UPDATE에 사용할 입력 데이터 타입 (기본: Partial<TEntity>)
 */
export interface IUpdateBuilder<TEntity extends QueryResultRow = any, TUpdate = Partial<TEntity>> {
    /**
     * SET 절에 사용할 값 설정
     */
    set(values: TUpdate): IUpdateBuilder<TEntity, TUpdate>;

    /**
     * WHERE 절 설정 (객체 또는 ConditionNode)
     */
    where(where: WhereInput): IUpdateBuilder<TEntity, TUpdate>;

    /**
     * RETURNING 절 설정 (기본: "*")
     */
    returning(columns?: (keyof TEntity | string)[]): IUpdateBuilder<TEntity, TUpdate>;

    /**
     * 쿼리 실행
     */
    execute(options?: HandlerOption): Promise<TEntity[] | null>;
}

/**
 * UpdateBuilder 구현체
 */
export class UpdateBuilder<TEntity extends QueryResultRow = any, TUpdate = Partial<TEntity>>
    implements IUpdateBuilder<TEntity, TUpdate>
{
    private tableName: string;
    private logger: Logger;
    private values: TUpdate | null = null;
    private whereInput: WhereInput = null;
    private returningColumns?: string[];

    constructor(tableName: string, logger: Logger) {
        this.tableName = tableName;
        this.logger = logger;
    }

    set(values: TUpdate): IUpdateBuilder<TEntity, TUpdate> {
        this.values = values;
        return this;
    }

    where(where: WhereInput): IUpdateBuilder<TEntity, TUpdate> {
        this.whereInput = where;
        return this;
    }

    returning(columns?: (keyof TEntity | string)[]): IUpdateBuilder<TEntity, TUpdate> {
        this.returningColumns = columns?.map((c) => String(c));
        return this;
    }

    async execute(options?: HandlerOption): Promise<TEntity[] | null> {
        if (!this.values) {
            throw new Error("Update values are not set.");
        }

        return await handler(
            async (connection: PoolClient) => {
                const data = this.values as Record<string, any>;
                const entries = Object.entries(data).filter(([, value]) => value !== undefined);

                if (entries.length === 0) {
                    throw new Error("No columns to update.");
                }

                const setClauses: string[] = [];
                const params: any[] = [];
                let paramIndex = 1;

                for (const [column, value] of entries) {
                    setClauses.push(`${column} = $${paramIndex++}`);
                    params.push(value);
                }

                const setSql = setClauses.join(", ");

                // WHERE 절은 SET 이후의 인덱스부터 시작
                const { sql: whereSql, params: whereParams } = buildWhereClause(this.whereInput, paramIndex);
                const allParams = params.concat(whereParams);

                let query = `UPDATE ${this.tableName} SET ${setSql}`;
                if (whereSql) {
                    query += ` ${whereSql}`;
                }

                const returningClause =
                    this.returningColumns && this.returningColumns.length > 0
                        ? ` RETURNING ${this.returningColumns.join(", ")}`
                        : " RETURNING *";

                query += returningClause;

                this.logger.debug(`Executing UPDATE: ${query}`, allParams);

                const result = await connection.query<TEntity>(query, allParams);
                return result.rows;
            },
            { useTransaction: true, ...options }
        );
    }
}

/**
 * Update 함수 타입
 */
export type UpdateFunction<TEntity extends QueryResultRow = any, TUpdate = Partial<TEntity>> = () => IUpdateBuilder<
    TEntity,
    TUpdate
>;

/**
 * Update 함수를 생성합니다
 */
export function createUpdateFunction<TEntity extends QueryResultRow = any, TUpdate = Partial<TEntity>>(
    tableName: string,
    logger: Logger
): UpdateFunction<TEntity, TUpdate> {
    return function update(): IUpdateBuilder<TEntity, TUpdate> {
        return new UpdateBuilder<TEntity, TUpdate>(tableName, logger);
    };
}

