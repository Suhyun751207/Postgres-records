import { QueryResultRow } from "pg";
import { ISelectBuilder, SelectBuilder } from "../select";

/**
 * ORDER BY 절을 SQL로 변환
 */
export function buildOrderByClause(orderByList: { column: string; order: "ASC" | "DESC" }[]): string {
    if (orderByList.length === 0) {
        return "";
    }
    const orderByParts = orderByList.map((item) => `${item.column} ${item.order}`);
    return `ORDER BY ${orderByParts.join(", ")}`;
}

/**
 * ORDER BY 추가
 */
export function addOrderBy<TEntity extends QueryResultRow = any>(
    builder: ISelectBuilder<TEntity>,
    columnOrOptions: string | { column: string; order?: "ASC" | "DESC" },
    order?: "ASC" | "DESC"
): ISelectBuilder<TEntity> {
    if (builder instanceof SelectBuilder) {
        const orderByList = (builder as any).getOrderByList();
        if (typeof columnOrOptions === "string") {
            orderByList.push({ column: columnOrOptions, order: order || "ASC" });
        } else {
            orderByList.push({ column: columnOrOptions.column, order: columnOrOptions.order || "ASC" });
        }
        (builder as any).setOrderByList(orderByList);
    }
    return builder;
}

/**
 * SelectBuilder에 orderBy 메서드 추가
 */
export function extendSelectBuilderWithOrderBy<TEntity extends QueryResultRow = any>(
    builder: ISelectBuilder<TEntity>
): ISelectBuilder<TEntity> & {
    orderBy(column: string, order?: "ASC" | "DESC"): ISelectBuilder<TEntity>;
    orderBy(options: { column: string; order?: "ASC" | "DESC" }): ISelectBuilder<TEntity>;
} {
    const extended = builder as any;
    if (!extended.orderBy) {
        extended.orderBy = function (
            columnOrOptions: string | { column: string; order?: "ASC" | "DESC" },
            order?: "ASC" | "DESC"
        ) {
            return addOrderBy(this, columnOrOptions, order);
        };
    }
    return extended;
}
