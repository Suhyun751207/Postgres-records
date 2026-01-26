/**
 * 연산자 타입 정의
 * =, !=, >, <, >=, <=, LIKE, IN, NOT IN, BETWEEN 등을 지원합니다.
 */
export type ComparisonOperator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE";

export type CollectionOperator = "IN" | "NOT IN" | "BETWEEN";

export type Operator = ComparisonOperator | CollectionOperator;

/**
 * 단일 값 비교 조건
 */
export interface SingleValueCondition {
    field: string;
    operator: ComparisonOperator;
    value: any;
}

/**
 * 컬렉션 (IN / NOT IN) 조건
 */
export interface InCondition {
    field: string;
    operator: "IN" | "NOT IN";
    value: any[];
}

/**
 * BETWEEN 조건
 */
export interface BetweenCondition {
    field: string;
    operator: "BETWEEN";
    value: [any, any];
}

/**
 * 필드 조건 (기본 단위 조건)
 */
export type FieldCondition = SingleValueCondition | InCondition | BetweenCondition;

/**
 * 연산자별 헬퍼
 */
export function eq(field: string, value: any): SingleValueCondition {
    return { field, operator: "=", value };
}

export function ne(field: string, value: any): SingleValueCondition {
    return { field, operator: "!=", value };
}

export function gt(field: string, value: any): SingleValueCondition {
    return { field, operator: ">", value };
}

export function gte(field: string, value: any): SingleValueCondition {
    return { field, operator: ">=", value };
}

export function lt(field: string, value: any): SingleValueCondition {
    return { field, operator: "<", value };
}

export function lte(field: string, value: any): SingleValueCondition {
    return { field, operator: "<=", value };
}

export function like(field: string, value: any): SingleValueCondition {
    return { field, operator: "LIKE", value };
}

export function inArray(field: string, value: any[]): InCondition {
    return { field, operator: "IN", value };
}

export function notInArray(field: string, value: any[]): InCondition {
    return { field, operator: "NOT IN", value };
}

export function between(field: string, from: any, to: any): BetweenCondition {
    return { field, operator: "BETWEEN", value: [from, to] };
}
