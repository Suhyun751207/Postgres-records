import { QueryResultRow } from "pg";
import { Logger } from "../../utils/logger";
import { handler } from "../../utils/transaction";
import { HandlerOption } from "../../interfaces/HandlerOption";
import { PoolClient } from "pg";
import { buildWhereClause } from "../select/where";

export interface ICountBuilder<TEntity extends QueryResultRow = any> {
    where(conditions: Record<string, any>): ICountBuilder<TEntity>;
    execute(options?: HandlerOption): Promise<number | null>;
}

export type CountFunction<TEntity extends QueryResultRow = any> = () => ICountBuilder<TEntity>;

export function createCountFunction<TEntity extends QueryResultRow = any>(tableName: string, logger: Logger): CountFunction<TEntity> {
    return function count(): ICountBuilder<TEntity> {
        return new CountBuilder<TEntity>(tableName, logger);
    };
}

export class CountBuilder<TEntity extends QueryResultRow = any> implements ICountBuilder<TEntity> {
    private tableName: string;
    private logger: Logger;
    private whereConditions: Record<string, any> = {};

    constructor(tableName: string, logger: Logger) {
        this.tableName = tableName;
        this.logger = logger;
    }

    where(conditions: Record<string, any>): ICountBuilder<TEntity> {
        this.whereConditions = { ...this.whereConditions, ...conditions };
        return this;
    }

    async execute(options?: HandlerOption): Promise<number | null> {
        return await handler(
            async (connection: PoolClient) => {
                const whereClause = buildWhereClause(this.whereConditions);
                const query = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause.sql ? `WHERE ${whereClause.sql}` : ""}`;
                const result = await connection.query<{ count: string }>(query);
                return Number(result.rows[0].count);
            },
            { useTransaction: true, ...options }
        );
    }
}