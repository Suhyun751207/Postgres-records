import { QueryResultRow } from "pg";
import { ISelectBuilder, SelectBuilder } from "../select";

/**
 * LIMIT 절을 SQL로 변환
 */
export function buildLimitClause(limit?: number): string {
    return limit !== undefined ? `LIMIT ${limit}` : "";
}

/**
 * OFFSET 절을 SQL로 변환
 */
export function buildOffsetClause(offset?: number): string {
    return offset !== undefined ? `OFFSET ${offset}` : "";
}

/**
 * LIMIT 설정
 */
export function setLimit<TEntity extends QueryResultRow = any>(
    builder: ISelectBuilder<TEntity>,
    count: number
): ISelectBuilder<TEntity> {
    if (builder instanceof SelectBuilder) {
        (builder as any).setLimitCount(count);
    }
    return builder;
}

/**
 * OFFSET 설정
 */
export function setOffset<TEntity extends QueryResultRow = any>(
    builder: ISelectBuilder<TEntity>,
    count: number
): ISelectBuilder<TEntity> {
    if (builder instanceof SelectBuilder) {
        (builder as any).setOffsetCount(count);
    }
    return builder;
}

/**
 * SelectBuilder에 limit, offset 메서드 추가
 */
export function extendSelectBuilderWithLimit<TEntity extends QueryResultRow = any>(
    builder: ISelectBuilder<TEntity>
): ISelectBuilder<TEntity> & {
    limit(count: number): ISelectBuilder<TEntity>;
    offset(count: number): ISelectBuilder<TEntity>;
} {
    const extended = builder as any;
    if (!extended.limit) {
        extended.limit = function (count: number) {
            return setLimit(this, count);
        };
    }
    if (!extended.offset) {
        extended.offset = function (count: number) {
            return setOffset(this, count);
        };
    }
    return extended;
}
