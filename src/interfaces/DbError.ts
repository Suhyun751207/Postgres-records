/**
 * PostgreSQL 데이터베이스 에러 인터페이스
 */
export interface DbError extends Error {
    code?: string;
    detail?: string;
    hint?: string;
    position?: string;
    internalPosition?: string;
    internalQuery?: string;
    where?: string;
    schema?: string;
    table?: string;
    column?: string;
    dataType?: string;
    constraint?: string;
    file?: string;
    line?: string;
    routine?: string;
    severity?: string;
    sqlState?: string;
    sqlMessage?: string;
}

/**
 * 데이터베이스 에러 클래스
 */
export class DatabaseError extends Error implements DbError {
    code?: string;
    detail?: string;
    hint?: string;
    position?: string;
    internalPosition?: string;
    internalQuery?: string;
    where?: string;
    schema?: string;
    table?: string;
    column?: string;
    dataType?: string;
    constraint?: string;
    file?: string;
    line?: string;
    routine?: string;
    severity?: string;
    sqlState?: string;
    sqlMessage?: string;

    constructor(error: any) {
        super(error.message || "Database error occurred");
        this.name = "DatabaseError";
        
        // PostgreSQL 에러 속성 복사
        this.code = error.code;
        this.detail = error.detail;
        this.hint = error.hint;
        this.position = error.position;
        this.internalPosition = error.internalPosition;
        this.internalQuery = error.internalQuery;
        this.where = error.where;
        this.schema = error.schema;
        this.table = error.table;
        this.column = error.column;
        this.dataType = error.dataType;
        this.constraint = error.constraint;
        this.file = error.file;
        this.line = error.line;
        this.routine = error.routine;
        this.severity = error.severity;
        this.sqlState = error.code;
        this.sqlMessage = error.message;

        // 스택 트레이스 유지
        if (error.stack) {
            this.stack = error.stack;
        }
    }
}

/**
 * 에러가 데이터베이스 에러인지 확인
 */
export function isDbError(error: any): error is DbError {
    return (
        error instanceof DatabaseError ||
        (error && typeof error === "object" && ("code" in error || "sqlState" in error))
    );
}
