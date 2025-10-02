import { SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';
export declare function getSupabaseClient(): SupabaseClient;
export declare function withRetry<T>(operation: () => Promise<T>, maxRetries?: number, delayMs?: number): Promise<T>;
