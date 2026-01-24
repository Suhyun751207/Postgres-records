/**
 * 로그 레벨 타입
 */
export type LogLevel = "debug" | "info" | "log" | "warn" | "error";

/**
 * 로거 설정 인터페이스
 */
export interface LoggerConfig {
    level?: LogLevel;
    enableColors?: boolean;
    enableTimestamp?: boolean;
    prefix?: string;
}

/**
 * ANSI 색상 코드
 */
const Colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
} as const;

/**
 * 로그 레벨 우선순위
 */
const LogLevelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    log: 2,
    warn: 3,
    error: 4,
};

/**
 * 로그 레벨별 색상
 */
const LogLevelColors: Record<LogLevel, string> = {
    debug: Colors.gray,
    info: Colors.cyan,
    log: Colors.white,
    warn: Colors.yellow,
    error: Colors.red,
};

/**
 * 로거 클래스
 */
export class Logger {
    private config: Required<LoggerConfig>;
    private currentLevel: LogLevel;

    constructor(config: LoggerConfig = {}) {
        // 환경 변수에서 로그 레벨 읽기
        const envLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || "log";
        const validLevels: LogLevel[] = ["debug", "info", "log", "warn", "error"];
        const level = validLevels.includes(envLevel) ? envLevel : "log";

        this.config = {
            level,
            enableColors: config.enableColors ?? process.env.LOG_COLORS !== "false",
            enableTimestamp: config.enableTimestamp ?? process.env.LOG_TIMESTAMP !== "false",
            prefix: config.prefix || "",
        };

        this.currentLevel = this.config.level;
    }

    /**
     * 타임스탬프 생성
     */
    private getTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * 로그 레벨 확인
     */
    private shouldLog(level: LogLevel): boolean {
        return LogLevelPriority[level] >= LogLevelPriority[this.currentLevel];
    }

    /**
     * 로그 포맷팅
     */
    private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
        const prefix = "[Postgres-records] : ";
        const levelStr = level.toLowerCase();
        if (this.config.enableColors) {
            return `${prefix}${LogLevelColors[level]}${levelStr}${Colors.reset} - ${message}`;
        } else {
            return `${prefix}${levelStr} - ${message}`;
        }
    }

    /**
     * 로그 출력
     */
    private write(level: LogLevel, message: string, ...args: any[]): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, ...args);

        switch (level) {
            case "debug":
                console.debug(formattedMessage, ...args);
                break;
            case "info":
                console.info(formattedMessage, ...args);
                break;
            case "log":
                console.log(formattedMessage, ...args);
                break;
            case "warn":
                console.warn(formattedMessage, ...args);
                break;
            case "error":
                console.error(formattedMessage, ...args);
                break;
        }
    }

    /**
     * 로그 레벨 설정
     */
    setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    /**
     * 현재 로그 레벨 반환
     */
    getLevel(): LogLevel {
        return this.currentLevel;
    }

    /**
     * Debug 레벨 로그
     */
    debug(message: string, ...args: any[]): void {
        this.write("debug", message, ...args);
    }

    /**
     * Info 레벨 로그
     */
    info(message: string, ...args: any[]): void {
        this.write("info", message, ...args);
    }

    /**
     * Log 레벨 로그
     */
    log(message: string, ...args: any[]): void {
        this.write("log", message, ...args);
    }

    /**
     * Warning 레벨 로그
     */
    warn(message: string, ...args: any[]): void {
        this.write("warn", message, ...args);
    }

    /**
     * Error 레벨 로그
     */
    error(message: string, ...args: any[]): void {
        this.write("error", message, ...args);
    }

    /**
     * 에러 객체를 로깅합니다
     */
    errorWithStack(message: string, error: Error | unknown): void {
        if (error instanceof Error) {
            this.write("error", message, error.message);
            if (error.stack) {
                this.write("error", error.stack);
            }
        } else {
            this.write("error", message, String(error));
        }
    }
}

/**
 * 기본 로거 인스턴스
 */
let defaultLogger: Logger | null = null;

/**
 * 기본 로거 인스턴스를 반환합니다
 */
export function getLogger(config?: LoggerConfig): Logger {
    if (!defaultLogger) {
        defaultLogger = new Logger(config);
    }
    return defaultLogger;
}

/**
 * 새로운 로거 인스턴스를 생성합니다
 */
export function createLogger(config?: LoggerConfig): Logger {
    return new Logger(config);
}

/**
 * 기본 로거 인스턴스를 리셋합니다
 */
export function resetLogger(): void {
    defaultLogger = null;
}

// 기본 export
export default getLogger();
