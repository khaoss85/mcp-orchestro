export type GuardianType = 'database' | 'architecture' | 'duplication' | 'test' | 'security' | 'performance' | 'custom';
export type ValidationLevel = 'warning' | 'error' | 'info' | 'fixed';
export interface GuardianAgent {
    id: string;
    projectId: string;
    name: string;
    guardianType: GuardianType;
    enabled: boolean;
    canAutoFix: boolean;
    rules: GuardianRule[];
    configuration: Record<string, any>;
    priority: number;
    createdAt: string;
    updatedAt: string;
}
export interface GuardianRule {
    id: string;
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    autoFixable: boolean;
    checkFunction?: string;
    fixFunction?: string;
}
export interface GuardianValidation {
    id: string;
    guardianId: string;
    taskId: string;
    validationType: ValidationLevel;
    message: string;
    details: Record<string, any>;
    autoFixed: boolean;
    createdAt: string;
}
export interface GuardianAgentInput {
    name: string;
    guardianType: GuardianType;
    enabled?: boolean;
    canAutoFix?: boolean;
    rules?: GuardianRule[];
    configuration?: Record<string, any>;
    priority?: number;
}
export interface GuardianValidationInput {
    guardianId: string;
    taskId: string;
    validationType: ValidationLevel;
    message: string;
    details?: Record<string, any>;
    autoFixed?: boolean;
}
export interface GuardianValidationResult {
    guardianName: string;
    validationType: ValidationLevel;
    message: string;
    details: Record<string, any>;
    canBlock: boolean;
}
export interface GuardianReport {
    guardianName: string;
    totalValidations: number;
    warnings: number;
    errors: number;
    fixes: number;
    lastRun?: string;
}
export interface GuardianRunContext {
    taskId: string;
    taskDescription: string;
    filesToModify?: string[];
    filesToCreate?: string[];
    dependencies?: any[];
    metadata?: Record<string, any>;
}
export interface DatabaseGuardianConfig {
    checkSchemaConsistency: boolean;
    preventDuplicateTables: boolean;
    validateMigrations: boolean;
    ensureIndexesOnFK: boolean;
    checkCascadeRules: boolean;
}
export interface ArchitectureGuardianConfig {
    detectCircularDependencies: boolean;
    enforceLayerBoundaries: boolean;
    checkNamingConventions: boolean;
    validateModuleStructure: boolean;
    layerRules?: {
        allowedDependencies: Record<string, string[]>;
    };
}
export interface DuplicationGuardianConfig {
    similarityThreshold: number;
    checkFunctions: boolean;
    checkComponents: boolean;
    checkUtilities: boolean;
    excludePatterns?: string[];
}
export interface TestGuardianConfig {
    minimumCoverage: number;
    enforceTestNaming: boolean;
    requiredTestPatterns: string[];
    testFileLocations: string[];
}
export interface SecurityGuardianConfig {
    checkSQLInjection: boolean;
    checkXSS: boolean;
    checkAuthorizationChecks: boolean;
    checkSecretsInCode: boolean;
    allowedPatterns?: string[];
}
export interface PerformanceGuardianConfig {
    checkNPlusOne: boolean;
    checkLargePayloads: boolean;
    checkUnindexedQueries: boolean;
    maxQueryComplexity: number;
}
export interface GuardianAgentRow {
    id: string;
    project_id: string;
    name: string;
    guardian_type: string;
    enabled: boolean;
    can_auto_fix: boolean;
    rules: any;
    configuration: any;
    priority: number;
    created_at: string;
    updated_at: string;
}
export interface GuardianValidationRow {
    id: string;
    guardian_id: string;
    task_id: string;
    validation_type: string;
    message: string;
    details: any;
    auto_fixed: boolean;
    created_at: string;
}
export interface IGuardian {
    name: string;
    guardianType: GuardianType;
    /**
     * Validate context and return warnings/errors
     */
    validate(context: GuardianRunContext): Promise<GuardianValidationResult[]>;
    /**
     * Auto-fix an issue if possible
     */
    autoFix?(issue: GuardianValidationResult, context: GuardianRunContext): Promise<GuardianRunContext>;
    /**
     * Check if guardian is enabled
     */
    isEnabled(): boolean;
}
export interface GuardianFactory {
    createGuardian(type: GuardianType, config: Record<string, any>): IGuardian;
}
