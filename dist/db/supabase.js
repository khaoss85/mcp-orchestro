import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
let supabaseClient = null;
export function getSupabaseClient() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
    }
    if (!supabaseClient) {
        supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false, // Server-side, no session needed
            },
            global: {
                fetch: fetch.bind(globalThis), // Ensure fetch is available
            },
        });
    }
    return supabaseClient;
}
// Retry logic wrapper
export async function withRetry(operation, maxRetries = 3, delayMs = 1000) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            // Don't retry on client errors (4xx)
            if (lastError.message.includes('400') || lastError.message.includes('404')) {
                throw lastError;
            }
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
            }
        }
    }
    throw lastError || new Error('Operation failed after retries');
}
