import { QueryResultRow } from "pg";
import { ISelectBuilder, SelectBuilder } from "../select";
import { FieldCondition } from "./operators";
import { ConditionNode, LogicalCondition, and } from "./conditions";

/**
 * WHERE 절 입력 타입
 * - 단순 객체 형태 (기존 방식): { isValid: true, id: 1 }
 * - 조건 트리 (ConditionNode): and/or/not, 연산자 조합
 */
export type WhereInput = Record<string, any> | ConditionNode | null | undefined;

/**
 * 단순 객체 형태의 where를 ConditionNode로 변환
 */
function recordToConditionNode(where: Record<string, any>): ConditionNode | null {
    const fieldConditions: FieldCondition[] = [];

    for (const [key, value] of Object.entries(where)) {
        if (value === undefined) {
            continue;
        } else if (Array.isArray(value)) {
            // 배열은 IN 조건으로 처리
            fieldConditions.push({
                field: key,
                operator: "IN",
                value,
            });
        } else if (value !== undefined) {
            // 나머지는 기본적으로 '=' 조건
            fieldConditions.push({
                field: key,
                operator: "=",
                value,
            } as FieldCondition);
        }
    }

    if (fieldConditions.length === 0) {
        return null;
    }

    if (fieldConditions.length === 1) {
        return fieldConditions[0];
    }

    return and(...fieldConditions);
}

/**
 * ConditionNode를 SQL과 파라미터로 변환 (재귀적 처리)
 */
function buildConditionNode(
    node: ConditionNode,
    startIndex: number
): { sql: string; params: any[]; nextIndex: number } {
    // FieldCondition
    if (!("type" in node)) {
        const fieldCond = node as FieldCondition;
        const { field, operator } = fieldCond;
        const params: any[] = [];
        let sql = "";
        let index = startIndex;

        if (operator === "IN" || operator === "NOT IN") {
            const values = fieldCond.value || [];
            if (!Array.isArray(values) || values.length === 0) {
                sql = operator === "IN" ? "1 = 0" : "1 = 1";
            } else {
                const placeholders = values.map(() => `$${index++}`).join(", ");
                sql = `${field} ${operator} (${placeholders})`;
                params.push(...values);
            }
        } else if (operator === "BETWEEN") {
            const [from, to] = fieldCond.value;
            sql = `${field} BETWEEN $${index++} AND $${index++}`;
            params.push(from, to);
        } else {
            const value = (fieldCond as any).value;
            if (value === null) {
                sql = `${field} IS NULL`;
            } else {
                sql = `${field} ${operator} $${index++}`;
                params.push(value);
            }
        }

        return { sql, params, nextIndex: index };
    }

    // LogicalCondition
    const logical = node as LogicalCondition;
    const parts: string[] = [];
    let params: any[] = [];
    let currentIndex = startIndex;

    if (logical.type === "NOT") {
        if (!logical.conditions || logical.conditions.length === 0) {
            return { sql: "", params: [], nextIndex: currentIndex };
        }
        const child = logical.conditions[0];
        const built = buildConditionNode(child, currentIndex);
        if (!built.sql) {
            return { sql: "", params: [], nextIndex: built.nextIndex };
        }
        return {
            sql: `NOT (${built.sql})`,
            params: built.params,
            nextIndex: built.nextIndex,
        };
    }

    const joiner = logical.type === "AND" ? " AND " : " OR ";

    for (const child of logical.conditions || []) {
        const built = buildConditionNode(child, currentIndex);
        if (built.sql) {
            parts.push(`(${built.sql})`);
            params = params.concat(built.params);
            currentIndex = built.nextIndex;
        }
    }

    const sql = parts.join(joiner);
    return { sql, params, nextIndex: currentIndex };
}

/**
 * WHERE 조건을 SQL로 변환
 * - 단순 객체 또는 ConditionNode 둘 다 지원
 * @param where   WHERE 조건 입력
 * @param startIndex 파라미터 플레이스홀더 시작 인덱스 (기본값: 1)
 */
export function buildWhereClause(where: WhereInput, startIndex: number = 1): { sql: string; params: any[] } {
    if (!where) {
        return { sql: "", params: [] };
    }

    let conditionNode: ConditionNode | null;

    if ((where as any).type || (where as any).field) {
        // 이미 ConditionNode 형태
        conditionNode = where as ConditionNode;
    } else {
        // 단순 객체 형태
        conditionNode = recordToConditionNode(where as Record<string, any>);
    }

    if (!conditionNode) {
        return { sql: "", params: [] };
    }

    const built = buildConditionNode(conditionNode, startIndex);

    if (!built.sql) {
        return { sql: "", params: [] };
    }

    return {
        sql: `WHERE ${built.sql}`,
        params: built.params,
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
