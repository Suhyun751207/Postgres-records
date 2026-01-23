/**
 * 트랜잭션 핸들러 옵션 인터페이스
 */
export interface HandlerOption {
    /**
     * 에러 발생 시 예외를 던질지 여부
     * @default true
     */
    throwError?: boolean;

    /**
     * SQL 에러를 출력할지 여부
     * @default true
     */
    printSqlError?: boolean;

    /**
     * 에러 발생 시 롤백할지 여부
     * @default true
     */
    rollbackIfError?: boolean;

    /**
     * 트랜잭션을 사용할지 여부
     * @default true
     */
    useTransaction?: boolean;
}
