import { PoolClient, QueryResultRow } from "pg";
import { handler } from "../../utils/transaction";
import { HandlerOption } from "../../interfaces/HandlerOption";
import { Logger } from "../../utils/logger";

/**
 * InsertBuilder 인터페이스
 * TEntity: INSERT 후 반환 받을 행 타입 (DB row)
 * TInsert: INSERT에 사용할 입력 데이터 타입 (기본: Partial<TEntity>)
 */
export interface IInsertBuilder<TEntity extends QueryResultRow = any, TInsert = Partial<TEntity>> {
    /**
     * INSERT 할 값 설정 (단일 또는 복수)
     */
    values(data: TInsert | TInsert[]): IInsertBuilder<TEntity, TInsert>;

    /**
     * RETURNING 절 설정 (기본: "*")
     */
    returning(columns?: (keyof TEntity | string)[]): IInsertBuilder<TEntity, TInsert>;

    /**
     * 쿼리 실행
     */
    execute(options?: HandlerOption): Promise<TEntity[] | null>;
}

/**
 * InsertBuilder 구현체
 */
export class InsertBuilder<TEntity extends QueryResultRow = any, TInsert = Partial<TEntity>>
    implements IInsertBuilder<TEntity, TInsert>
{
    private tableName: string;
    private logger: Logger;
    private rows: TInsert[] = [];
    private returningColumns?: string[];

    constructor(tableName: string, logger: Logger) {
        this.tableName = tableName;
        this.logger = logger;
    }

    values(data: TInsert | TInsert[]): IInsertBuilder<TEntity, TInsert> {
        if (Array.isArray(data)) {
            this.rows = data;
        } else {
            this.rows = [data];
        }
        return this;
    }

    returning(columns?: (keyof TEntity | string)[]): IInsertBuilder<TEntity, TInsert> {
        this.returningColumns = columns?.map((c) => String(c));
        return this;
    }

    async execute(options?: HandlerOption): Promise<TEntity[] | null> {
        if (this.rows.length === 0) {
            throw new Error("Insert values are not set.");
        }

        return await handler(
            async (connection: PoolClient) => {
                const first = this.rows[0] as Record<string, any>;
                const columns = Object.keys(first);

                if (columns.length === 0) {
                    throw new Error("No columns to insert.");
                }

                const values: any[] = [];
                const valueGroups: string[] = [];
                let paramIndex = 1;

                for (const row of this.rows) {
                    const record = row as Record<string, any>;
                    const rowValues = columns.map((col) => record[col]);
                    const placeholders = rowValues.map(() => `$${paramIndex++}`).join(", ");
                    valueGroups.push(`(${placeholders})`);
                    values.push(...rowValues);
                }

                const returningClause =
                    this.returningColumns && this.returningColumns.length > 0
                        ? ` RETURNING ${this.returningColumns.join(", ")}`
                        : " RETURNING *";

                const query = `INSERT INTO ${this.tableName} (${columns.join(
                    ", "
                )}) VALUES ${valueGroups.join(", ")}${returningClause}`;

                this.logger.debug(`Executing INSERT: ${query}`, values);

                const result = await connection.query<TEntity>(query, values);
                return result.rows;
            },
            { useTransaction: true, ...options }
        );
    }
}

/**
 * Insert 함수 타입
 */
export type InsertFunction<TEntity extends QueryResultRow = any, TInsert = Partial<TEntity>> = (
    data?: TInsert | TInsert[]
) => IInsertBuilder<TEntity, TInsert>;

/**
 * Insert 함수를 생성합니다
 */
export function createInsertFunction<TEntity extends QueryResultRow = any, TInsert = Partial<TEntity>>(
    tableName: string,
    logger: Logger
): InsertFunction<TEntity, TInsert> {
    return function insert(data?: TInsert | TInsert[]): IInsertBuilder<TEntity, TInsert> {
        const builder = new InsertBuilder<TEntity, TInsert>(tableName, logger);
        if (data !== undefined) {
            builder.values(data);
        }
        return builder;
    };
}

