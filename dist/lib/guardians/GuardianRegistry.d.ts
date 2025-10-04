import { IGuardian, GuardianType, GuardianValidationResult, GuardianRunContext, GuardianReport, GuardianFactory } from '../../types/guardians.js';
export declare class GuardianRegistry implements GuardianFactory {
    private guardians;
    /**
     * Create a guardian instance by type
     */
    createGuardian(type: GuardianType, config: Record<string, any>): IGuardian;
    /**
     * Load guardians for a project from database
     */
    loadGuardiansForProject(projectId: string): Promise<void>;
    /**
     * Run all guardians on a task context
     */
    runAllGuardians(context: GuardianRunContext): Promise<GuardianValidationResult[]>;
    /**
     * Save validation results to database
     */
    private saveValidations;
    /**
     * Get guardian report for a task
     */
    getGuardianReport(taskId: string): Promise<GuardianReport[]>;
    /**
     * Initialize default guardians for a project
     */
    static initializeDefaultGuardians(projectId: string): Promise<void>;
}
/**
 * Global guardian registry instance
 */
export declare const guardianRegistry: GuardianRegistry;
/**
 * Helper function to run guardians on a task
 */
export declare function runGuardiansOnTask(taskId: string, context: Omit<GuardianRunContext, 'taskId'>): Promise<GuardianValidationResult[]>;
