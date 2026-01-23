import { PoolClient } from "pg";
import { getConnection } from "../utils/connection";
import { handler } from "../utils/transaction";
import { HandlerOption } from "../interfaces/HandlerOption";
import { getLogger } from "../utils/logger";

/**
 * 리포지토리 옵션 인터페이스
 */
export interface RepositoryOptions {
  /**
   * 테이블 이름
   */
  table: string;
  /**
   * 테이블의 컬럼 키 목록
   */
  keys: string[];
  /**
   * 쿼리를 출력할지 여부
   */
  printQuery?: boolean;
}

/**
 * 리포지토리 인터페이스
 */
export interface Repository {
  /**
   * 테이블 이름
   */
  table: string;
  /**
   * 테이블의 컬럼 키 목록
   */
  keys: string[];
  /**
   * 쿼리를 출력할지 여부
   */
  printQuery?: boolean;
  /**
   * 데이터베이스 연결을 가져옵니다
   * @returns PostgreSQL 클라이언트 또는 null
   */
  getConnection(): Promise<PoolClient | null>;
  /**
   * 연결을 사용하여 쿼리를 실행합니다
   * @param callback 연결을 사용하는 콜백 함수
   * @param option 핸들러 옵션
   * @returns 콜백 함수의 반환값 또는 null (에러 발생 시)
   */
  query<T>(
    callback: (connection: PoolClient) => Promise<T>,
    option?: HandlerOption
  ): Promise<T | null>;
}

/**
 * 리포지토리를 생성합니다
 * @param options 리포지토리 옵션 (테이블 이름과 키)
 * @returns 리포지토리 객체
 * 
 * @example
 * ```typescript
 * const userRepository = createRepository({
 *   table: "users",
 *   keys: ["id", "name", "email", "created_at"]
 * });
 * 
 * // 연결 가져오기
 * const connection = await userRepository.getConnection();
 * 
 * // 쿼리 실행
 * const users = await userRepository.query(async (conn) => {
 *   const result = await conn.query("SELECT * FROM users");
 *   return result.rows;
 * });
 * ```
 */
export function createRepository(options: RepositoryOptions): Repository {
  const { table, keys, printQuery = false } = options;
  const logger = getLogger();

  /**
   * PoolClient의 query 메서드를 래핑하여 쿼리를 로그로 출력
   */
  const wrapConnection = (client: PoolClient): PoolClient => {
    if (!printQuery) {
      return client;
    }

    const originalQuery = client.query.bind(client);
    const wrappedClient = Object.create(Object.getPrototypeOf(client));
    Object.assign(wrappedClient, client);

    wrappedClient.query = function (text: any, params?: any, callback?: any) {
      // 쿼리 문자열 로그 출력
      if (typeof text === "string") {
        logger.debug(`[${table}] Query: ${text}`);
        if (params && params.length > 0) {
          logger.debug(`[${table}] Params:`, params);
        }
      } else if (text && typeof text.text === "string") {
        // QueryConfig 객체인 경우
        logger.debug(`[${table}] Query: ${text.text}`);
        if (text.values && text.values.length > 0) {
          logger.debug(`[${table}] Params:`, text.values);
        }
      }

      // 원본 query 메서드 호출
      return originalQuery(text, params, callback);
    };

    return wrappedClient as PoolClient;
  };

  return {
    table,
    keys,
    printQuery,
    /**
     * 데이터베이스 연결을 가져옵니다
     */
    async getConnection(): Promise<PoolClient | null> {
      const connection = await getConnection();
      if (connection && printQuery) {
        return wrapConnection(connection);
      }
      return connection;
    },
    /**
     * 연결을 사용하여 쿼리를 실행합니다
     */
    async query<T>(
      callback: (connection: PoolClient) => Promise<T>,
      option: HandlerOption = {
        throwError: true,
        printSqlError: true,
        rollbackIfError: true,
        useTransaction: true,
      }
    ): Promise<T | null> {
      if (!printQuery) {
        return await handler(callback, option);
      }

      // printQuery가 true인 경우 연결을 래핑하여 쿼리를 로그로 출력
      return await handler(
        async (connection: PoolClient) => {
          const wrappedConnection = wrapConnection(connection);
          return await callback(wrappedConnection);
        },
        option
      );
    },
  };
}
