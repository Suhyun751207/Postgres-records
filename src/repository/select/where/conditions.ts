import { FieldCondition } from "./operators";

/**
 * 논리 연산자 타입
 */
export type LogicalOperator = "AND" | "OR" | "NOT";

/**
 * 논리 조건 (AND, OR, NOT)
 */
export interface LogicalCondition {
    type: LogicalOperator;
    conditions: ConditionNode[];
}

/**
 * WHERE 조건 트리의 루트 타입
 */
export type ConditionNode = FieldCondition | LogicalCondition;

/**
 * AND 조합
 */
export function and(...conditions: ConditionNode[]): LogicalCondition {
    return {
        type: "AND",
        conditions,
    };
}

/**
 * OR 조합
 */
export function or(...conditions: ConditionNode[]): LogicalCondition {
    return {
        type: "OR",
        conditions,
    };
}

/**
 * NOT 조합
 */
export function not(...conditions: ConditionNode[]): LogicalCondition {
    return {
        type: "NOT",
        conditions,
    };
}

// AND, OR, NOT 조합 조건