import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { getConnectionPool } from "../configs/env";
import { getConnection } from "../utils/connection";
import { getLogger, createLogger, Logger } from "../utils/logger";
import { handler } from "../utils/transaction";
import { HandlerOption } from "../interfaces/HandlerOption";
import { createSelectFunction, ISelectBuilder } from "./select/select";
import { createInsertFunction, IInsertBuilder } from "./insert/insert";
import { createUpdateFunction, IUpdateBuilder } from "./update/update";
import { createDeleteFunction, IDeleteBuilder } from "./delete/delete";

/**
 * Repository 생성 옵션 인터페이스
 */
export interface RepositoryOptions<TEntity extends QueryResultRow = any, TCreate = any> {
  /**
   * 테이블 이름 (스키마 포함 가능, 예: "public.users" 또는 "users")
   */
  tableName: string;

  /**
   * 테이블의 키 컬럼 목록 (기본키 등)
   */
  keys?: string[];

  /**
   * 자동 설정되는 키 컬럼 목록 (예: id, created_at, updated_at 등)
   * create 시 이 필드들은 undefined로 처리되거나 자동으로 제외됩니다
   */
  autoSetKeys?: string[];

  /**
   * 로거 사용 여부 (true면 repository 전용 로거 생성, false면 기본 로거 사용)
   */
  logger?: boolean;

  /**
   * 커스텀 로거 인스턴스
   */
  customLogger?: Logger;
}

/**
 * Repository 인터페이스
 */
export interface Repository<TEntity extends QueryResultRow = any, TCreate = any> {
  /**
   * 테이블 이름
   */
  readonly tableName: string;

  /**
   * 키 컬럼 목록
   */
  readonly keys: string[];

  /**
   * 자동 설정되는 키 컬럼 목록
   */
  readonly autoSetKeys: string[];

  /**
   * 로거 인스턴스
   */
  readonly logger: Logger;

  /**
   * 원시 SQL 쿼리 실행
   */
  query(sql: string, params?: any[], options?: HandlerOption): Promise<QueryResult | null>;

  /**
   * DB 연결 풀 가져오기
   */
  getPool(): ReturnType<typeof getConnectionPool>;

  /**
   * DB 연결 가져오기
   */
  getConnection(): Promise<PoolClient | null>;

  /**
   * SELECT 쿼리 빌더 시작
   * @param columns 조회할 컬럼 목록 (선택사항, 기본값: "*")
   */
  select(columns?: string[]): ISelectBuilder<TEntity>;

  /**
   * INSERT 쿼리 빌더 시작
   * @param data 미리 지정할 값 (선택사항)
   * TCreate 제네릭으로 타입 안전한 입력 정의 가능
   */
  insert(data?: TCreate | TCreate[]): IInsertBuilder<TEntity, TCreate>;

  /**
   * UPDATE 쿼리 빌더 시작
   * 기본적으로 Partial<TEntity> 를 업데이트 타입으로 사용
   */
  update(): IUpdateBuilder<TEntity, Partial<TEntity>>;

  /**
   * DELETE 쿼리 빌더 시작
   */
  delete(): IDeleteBuilder<TEntity>;
}

/**
 * Repository 인스턴스 캐시
 * 같은 tableName으로 여러 번 호출해도 같은 인스턴스를 반환하여 연결 최적화
 */
const repositoryCache = new Map<string, Repository<any, any>>();

/**
 * Repository 인스턴스를 생성합니다
 * 같은 tableName으로 여러 번 호출해도 같은 인스턴스를 반환하여 연결 최적화
 * 
 * @param options Repository 생성 옵션
 * @returns Repository 인스턴스
 */
export function createRepository<TEntity extends QueryResultRow = any, TCreate = any>(
  options: RepositoryOptions<TEntity, TCreate>
): Repository<TEntity, TCreate> {
  const { tableName, keys = [], autoSetKeys = [], logger: useLogger, customLogger } = options;

  // 캐시 키 생성 (tableName 기반)
  const cacheKey = tableName;

  // 캐시에서 기존 인스턴스 확인
  if (repositoryCache.has(cacheKey)) {
    return repositoryCache.get(cacheKey)! as Repository<TEntity, TCreate>;
  }

  // 로거 설정
  const repoLogger = customLogger || (useLogger ? createLogger({ prefix: `Repository[${tableName}]` }) : getLogger());

  // DB 연결 풀 가져오기 (싱글톤)
  const pool = getConnectionPool();

  // Select 함수 생성
  const selectFn = createSelectFunction<TEntity>(tableName, repoLogger);
  // Insert / Update / Delete 함수 생성
  const insertFn = createInsertFunction<TEntity, TCreate>(tableName, repoLogger);
  const updateFn = createUpdateFunction<TEntity, Partial<TEntity>>(tableName, repoLogger);
  const deleteFn = createDeleteFunction<TEntity>(tableName, repoLogger);

  // Repository 구현
  const repository: Repository<TEntity, TCreate> = {
    tableName,
    keys,
    autoSetKeys,
    logger: repoLogger,

    async query(sql: string, params?: any[], options?: HandlerOption): Promise<QueryResult | null> {
      return await handler(
        async (connection: PoolClient) => {
          repoLogger.debug(`Executing query: ${sql}`, params || []);
          const result = await connection.query(sql, params);
          return result;
        },
        { useTransaction: false, ...options }
      );
    },

    getPool(): ReturnType<typeof getConnectionPool> {
      return pool;
    },

    async getConnection(): Promise<PoolClient | null> {
      return await getConnection();
    },

    select(columns?: string[]): ISelectBuilder<TEntity> {
      return selectFn(columns);
    },

    insert(data?: TCreate | TCreate[]): IInsertBuilder<TEntity, TCreate> {
      return insertFn(data);
    },

    update(): IUpdateBuilder<TEntity, Partial<TEntity>> {
      return updateFn();
    },

    delete(): IDeleteBuilder<TEntity> {
      return deleteFn();
    },
  };

  // 캐시에 저장
  repositoryCache.set(cacheKey, repository);

  return repository;
}

/**
 * Repository 캐시를 초기화합니다
 * 테스트나 특정 상황에서 사용
 */
export function clearRepositoryCache(): void {
  repositoryCache.clear();
}

/**
 * 특정 테이블의 Repository 캐시를 제거합니다
 */
export function removeRepositoryFromCache(tableName: string): void {
  repositoryCache.delete(tableName);
}
