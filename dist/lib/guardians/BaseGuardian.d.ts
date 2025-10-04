import { IGuardian, GuardianType, GuardianRunContext, GuardianValidationResult, ValidationLevel } from '../../types/guardians.js';
export declare abstract class BaseGuardian implements IGuardian {
    readonly name: string;
    readonly guardianType: GuardianType;
    protected config: Record<string, any>;
    protected enabled: boolean;
    constructor(name: string, guardianType: GuardianType, config?: Record<string, any>, enabled?: boolean);
    /**
     * Main validation method - to be implemented by each guardian
     */
    abstract validate(context: GuardianRunContext): Promise<GuardianValidationResult[]>;
    /**
     * Auto-fix method - optional, can be overridden
     */
    autoFix(issue: GuardianValidationResult, context: GuardianRunContext): Promise<GuardianRunContext>;
    /**
     * Check if guardian is enabled
     */
    isEnabled(): boolean;
    /**
     * Helper: Create validation result
     */
    protected createValidation(type: ValidationLevel, message: string, details?: Record<string, any>, canBlock?: boolean): GuardianValidationResult;
    /**
     * Helper: Create warning
     */
    protected warning(message: string, details?: Record<string, any>): GuardianValidationResult;
    /**
     * Helper: Create error
     */
    protected error(message: string, details?: Record<string, any>, canBlock?: boolean): GuardianValidationResult;
    /**
     * Helper: Create info
     */
    protected info(message: string, details?: Record<string, any>): GuardianValidationResult;
    /**
     * Helper: Create fixed notification
     */
    protected fixed(message: string, details?: Record<string, any>): GuardianValidationResult;
}
