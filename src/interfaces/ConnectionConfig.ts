import { DatabaseConfig } from "./DatabaseConfig";

/**
 * 연결 설정 확장 인터페이스
 * 커스텀 옵션 및 재시도 설정을 포함합니다
 */
export interface ConnectionConfig extends DatabaseConfig {
    /**
     * 연결 재시도 횟수
     * @default 3
     */
    connectionRetryCount?: number;

    /**
     * 연결 재시도 지연 시간 (밀리초)
     * @default 1000
     */
    connectionRetryDelay?: number;

    /**
     * Idle 타임아웃 (밀리초)
     * PostgreSQL wait_timeout보다 짧게 설정
     * @default 60000
     */
    idleTimeout?: number;

    /**
     * 자동 재연결 활성화 여부
     * @default true
     */
    reconnect?: boolean;

    /**
     * 날짜를 UTC로 변환하여 저장할지 여부
     * @default true
     */
    convertDateToUTC?: boolean;

    /**
     * 디버그 모드 활성화 여부
     * @default false
     */
    debug?: boolean;
}
