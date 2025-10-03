export interface Template {
    id: string;
    name: string;
    category: 'prompt' | 'code' | 'architecture' | 'review';
    content: string;
    variables: string[];
    created_at: string;
    updated_at: string;
}
export interface Pattern {
    id: string;
    name: string;
    category: string;
    description: string;
    examples: string[];
    tags: string[];
    created_at: string;
    updated_at: string;
}
export interface Learning {
    id: string;
    task_id?: string | null;
    context: string;
    action: string;
    result: string;
    lesson: string;
    type?: 'success' | 'failure' | 'improvement' | null;
    pattern?: string | null;
    tags: string[];
    created_at: string;
}
export interface PatternFrequency {
    id: string;
    pattern: string;
    frequency: number;
    last_seen: string;
    first_seen: string;
    success_count: number;
    failure_count: number;
    improvement_count: number;
    created_at: string;
    updated_at: string;
}
export declare function getTemplate(id: string): Promise<Template | undefined>;
export declare function listTemplates(params?: {
    category?: Template['category'];
}): Promise<Template[]>;
export declare function renderTemplate(id: string, variables: Record<string, any>): Promise<{
    success: boolean;
    rendered?: string;
    error?: string;
}>;
export declare function getPattern(id: string): Promise<Pattern | undefined>;
export declare function listPatterns(params?: {
    category?: string;
    tags?: string[];
}): Promise<Pattern[]>;
export declare function searchPatterns(query: string): Promise<Pattern[]>;
export declare function getLearning(id: string): Promise<Learning | undefined>;
export declare function listLearnings(params?: {
    tags?: string[];
}): Promise<Learning[]>;
export declare function searchLearnings(query: string, pattern?: string): Promise<Learning[]>;
export declare function getRelevantKnowledge(params: {
    taskTitle: string;
    taskDescription: string;
    tags?: string[];
    taskId?: string;
}): Promise<{
    templates: Template[];
    patterns: Pattern[];
    learnings: Learning[];
}>;
export declare function addFeedback(params: {
    taskId: string;
    feedback: string;
    type: 'success' | 'failure' | 'improvement';
    pattern: string;
    tags?: string[];
}): Promise<{
    success: boolean;
    learning?: Learning;
    error?: string;
}>;
export declare function getSimilarLearnings(params: {
    context: string;
    taskId?: string;
    type?: 'success' | 'failure' | 'improvement';
    pattern?: string;
}): Promise<Learning[]>;
export declare function getTopPatterns(limit?: number): Promise<PatternFrequency[]>;
export declare function getTrendingPatterns(days?: number, limit?: number): Promise<{
    pattern: string;
    recent_frequency: number;
    total_frequency: number;
    success_rate: number;
    last_seen: string;
}[]>;
export declare function getPatternStats(pattern: string): Promise<PatternFrequency | null>;
export interface FailurePattern {
    pattern: string;
    failure_rate: number;
    failure_count: number;
    total_count: number;
    last_failure: string;
    risk_level: 'high' | 'medium' | 'low';
    recommendation: string;
}
export declare function detectFailurePatterns(minOccurrences?: number, failureThreshold?: number): Promise<FailurePattern[]>;
export declare function checkPatternRisk(pattern: string): Promise<{
    is_risky: boolean;
    risk_level: 'high' | 'medium' | 'low' | 'none';
    failure_rate: number;
    recommendation: string;
    stats: PatternFrequency | null;
}>;
