/**
 * 환경 변수 읽기 유틸리티 함수
 * 타입에 따라 자동으로 파싱합니다
 * 
 * @param record 환경 변수 레코드
 * @param key 환경 변수 키
 * @param defaultValue 기본값 (타입에 따라 자동 판단)
 * @returns 파싱된 값 (기본값과 동일한 타입)
 * @throws {Error} Number 타입인 경우 유효하지 않은 숫자 값인 경우
 * 
 * @example
 * ```typescript
 * // Boolean
 * const debug = readEnv(process.env, "DEBUG", false); // boolean
 * 
 * // Number
 * const port = readEnv(process.env, "PORT", 3000); // number
 * 
 * // String
 * const host = readEnv(process.env, "HOST", "localhost"); // string
 * ```
 */
export function readEnv<T extends boolean | number | string>(
  record: Record<string, string | undefined>,
  key: string,
  defaultValue: T
): T {
  const value = record[key];

  // 값이 없으면 기본값 반환
  if (value === undefined) {
    return defaultValue;
  }

  // 타입에 따라 자동 파싱
  if (typeof defaultValue === "boolean") {
    if (value === "true") return true as T;
    if (value === "false") return false as T;
    return defaultValue;
  }

  if (typeof defaultValue === "number") {
    const number = Number(value);
    if (isNaN(number)) {
      throw new Error(`Invalid number value for ${key}: ${value}`);
    }
    return number as T;
  }

  if (typeof defaultValue === "string") {
    return value as T;
  }

  // 기본값의 타입을 알 수 없는 경우 기본값 반환
  return defaultValue;
}