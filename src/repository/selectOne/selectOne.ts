import { ISelectBuilder } from "../select/select";
import { PoolClient, QueryResultRow } from "pg";
import { HandlerOption } from "../../interfaces/HandlerOption";
import { Logger } from "../../utils/logger";
import { buildWhereClause } from "../select/where";
import { handler } from "../../utils/transaction";

export interface ISelectOneBuilder<TEntity extends QueryResultRow = any> {
    where(conditions: Record<string, any>): ISelectOneBuilder<TEntity>;
    execute(options?: HandlerOption): Promise<TEntity | null>;
}

export class SelectOneBuilder<TEntity extends QueryResultRow = any> implements ISelectOneBuilder<TEntity> {
    private tableName: string;
    private logger: Logger;
    private columns: string[] = [];
    private whereConditions: Record<string, any> = {};

    constructor(tableName: string, logger: Logger, columns?: string[]) {
        this.tableName = tableName;
        this.logger = logger;
        this.columns = columns || [];
    }

    where(conditions: Record<string, any>): ISelectOneBuilder<TEntity> {
        this.whereConditions = { ...this.whereConditions, ...conditions };
        return this;
    }

    async execute(options?: HandlerOption): Promise<TEntity | null> {
        return await handler(
            async (connection: PoolClient) => {
                const selectColumns = this.columns.length > 0 ? this.columns.join(", ") : "*";
                const { sql: whereSql, params } = buildWhereClause(this.whereConditions);
                const query = `SELECT ${selectColumns} FROM ${this.tableName} ${whereSql ? `${whereSql}` : ""}`;
                console.log(query)
                const result = await connection.query<TEntity>(query, params);
                return result.rows.length > 0 ? result.rows[0] : null;
            },
            { useTransaction: true, ...options }
        );
    }
}

export type SelectOneFunction<TEntity extends QueryResultRow = any> = (
    columns?: string[]
) => ISelectOneBuilder<TEntity>;

export function createSelectOneBuilder<TEntity extends QueryResultRow = any>(
    tableName: string,
    logger: Logger
): SelectOneFunction<TEntity> {
    return function selectOne(columns?: string[]): ISelectOneBuilder<TEntity> {
        return new SelectOneBuilder<TEntity>(tableName, logger, columns);
    };
}