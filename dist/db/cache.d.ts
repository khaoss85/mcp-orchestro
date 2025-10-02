declare class SimpleCache {
    private cache;
    private defaultTTL;
    set<T>(key: string, value: T, ttlMs?: number): void;
    get<T>(key: string): T | null;
    delete(key: string): void;
    clear(): void;
    clearPattern(pattern: string): void;
    startCleanup(intervalMs?: number): void;
}
export declare const cache: SimpleCache;
export {};
