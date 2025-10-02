export interface CodeEntity {
    id?: string;
    resource_id: string;
    type: 'function' | 'class' | 'interface' | 'component' | 'type' | 'variable' | 'constant';
    name: string;
    signature?: string;
    location: {
        startLine: number;
        endLine: number;
        startColumn: number;
        endColumn: number;
    };
    documentation?: string;
    exported: boolean;
    metrics: {
        cyclomatic?: number;
        cognitive?: number;
        maintainability?: number;
        loc?: number;
    };
}
export interface CodeDependency {
    from_entity_id: string;
    to_entity_id: string;
    dependency_type: 'import' | 'call' | 'extends' | 'implements' | 'type_reference';
}
export interface FileHistoryEntry {
    resource_id: string;
    commit_hash: string;
    author: string;
    date: Date;
    message: string;
    insertions: number;
    deletions: number;
}
export interface CodebaseAnalysisResult {
    success: boolean;
    total_files: number;
    total_entities: number;
    total_dependencies: number;
    analysis_duration_ms: number;
    error?: string;
}
/**
 * Analyze entire codebase and store results in database
 */
export declare function analyzeCodebase(rootPath: string, includeGitHistory?: boolean): Promise<CodebaseAnalysisResult>;
/**
 * Get entity by ID with health score
 */
export declare function getEntityWithHealth(entityId: string): Promise<any>;
/**
 * Get impact analysis for an entity
 */
export declare function getEntityImpact(entityId: string): Promise<any>;
/**
 * Get codebase tree structure
 */
export declare function getCodebaseTree(): Promise<any>;
