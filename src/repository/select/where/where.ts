import { QueryResultRow } from "pg";
import { ISelectBuilder, SelectBuilder } from "../select";

/**
 * WHERE 조건을 SQL로 변환
 */
export function buildWhereClause(where: Record<string, any>): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
        if (value === undefined) {
            // undefined는 조건에서 제외
            continue;
        } else if (value === null) {
            conditions.push(`${key} IS NULL`);
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                // 빈 배열은 항상 false
                conditions.push("1 = 0");
            } else {
                const placeholders = value.map(() => `$${paramIndex++}`).join(", ");
                conditions.push(`${key} IN (${placeholders})`);
                params.push(...value);
            }
        } else {
            conditions.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    }

    return {
        sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
        params,
    };
}

/**
 * WHERE 조건 추가
 */
export function addWhereCondition<TEntity extends QueryResultRow = any>(
    builder: ISelectBuilder<TEntity>,
    conditions: Record<string, any>
): ISelectBuilder<TEntity> {
    if (builder instanceof SelectBuilder) {
        // 기존 조건과 병합
        const existingConditions = (builder as any).getWhereConditions();
        const mergedConditions = { ...existingConditions, ...conditions };
        (builder as any).setWhereConditions(mergedConditions);
    }
    return builder;
}

/**
 * SelectBuilder에 where 메서드 추가
 */
export function extendSelectBuilderWithWhere<TEntity extends QueryResultRow = any>(
    builder: ISelectBuilder<TEntity>
): ISelectBuilder<TEntity> & { where(conditions: Record<string, any>): ISelectBuilder<TEntity> } {
    const extended = builder as any;
    if (!extended.where) {
        extended.where = function (conditions: Record<string, any>) {
            return addWhereCondition(this, conditions);
        };
    }
    return extended;
}
