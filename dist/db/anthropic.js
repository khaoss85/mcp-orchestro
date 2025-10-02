import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
let anthropicClient = null;
export function getAnthropicClient() {
    if (!process.env.ANTHROPIC_API_KEY) {
        return null;
    }
    if (!anthropicClient) {
        anthropicClient = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }
    return anthropicClient;
}
