// Orchestro Guardian Registry
// Central registry for all guardian agents
import { getSupabaseClient } from '../../db/supabase.js';
import { DatabaseGuardian } from './DatabaseGuardian.js';
import { ArchitectureGuardian } from './ArchitectureGuardian.js';
export class GuardianRegistry {
    guardians = new Map();
    /**
     * Create a guardian instance by type
     */
    createGuardian(type, config) {
        switch (type) {
            case 'database':
                return new DatabaseGuardian(config, config.enabled ?? true);
            case 'architecture':
                return new ArchitectureGuardian(config, config.enabled ?? true);
            // Add other guardians here
            default:
                throw new Error(`Unknown guardian type: ${type}`);
        }
    }
    /**
     * Load guardians for a project from database
     */
    async loadGuardiansForProject(projectId) {
        const supabase = getSupabaseClient();
        const { data: guardianRows, error } = await supabase
            .from('guardian_agents')
            .select('*')
            .eq('project_id', projectId)
            .eq('enabled', true);
        if (error) {
            console.error('Error loading guardians:', error);
            return;
        }
        this.guardians.clear();
        for (const row of guardianRows || []) {
            try {
                const guardian = this.createGuardian(row.guardian_type, {
                    ...row.configuration,
                    enabled: row.enabled,
                    canAutoFix: row.can_auto_fix,
                });
                this.guardians.set(row.id, guardian);
            }
            catch (err) {
                console.error(`Failed to create guardian ${row.name}:`, err);
            }
        }
        console.log(`Loaded ${this.guardians.size} guardians for project ${projectId}`);
    }
    /**
     * Run all guardians on a task context
     */
    async runAllGuardians(context) {
        const allResults = [];
        for (const [id, guardian] of this.guardians) {
            if (!guardian.isEnabled()) {
                continue;
            }
            try {
                const results = await guardian.validate(context);
                allResults.push(...results);
                // Save validations to database
                await this.saveValidations(id, context.taskId, results);
            }
            catch (err) {
                console.error(`Guardian ${guardian.name} failed:`, err);
                allResults.push({
                    guardianName: guardian.name,
                    validationType: 'error',
                    message: `Guardian execution failed: ${err}`,
                    details: { error: String(err) },
                    canBlock: false,
                });
            }
        }
        return allResults;
    }
    /**
     * Save validation results to database
     */
    async saveValidations(guardianId, taskId, results) {
        if (results.length === 0)
            return;
        const supabase = getSupabaseClient();
        const validations = results.map(result => ({
            guardian_id: guardianId,
            task_id: taskId,
            validation_type: result.validationType,
            message: result.message,
            details: result.details,
            auto_fixed: false,
        }));
        const { error } = await supabase.from('guardian_validations').insert(validations);
        if (error) {
            console.error('Error saving guardian validations:', error);
        }
    }
    /**
     * Get guardian report for a task
     */
    async getGuardianReport(taskId) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.rpc('get_guardian_report', {
            p_task_id: taskId,
        });
        if (error) {
            console.error('Error getting guardian report:', error);
            return [];
        }
        return (data || []).map((row) => ({
            guardianName: row.guardian_name,
            totalValidations: row.total_validations,
            warnings: row.warnings,
            errors: row.errors,
            fixes: row.fixes,
            lastRun: row.last_run,
        }));
    }
    /**
     * Initialize default guardians for a project
     */
    static async initializeDefaultGuardians(projectId) {
        const supabase = getSupabaseClient();
        // Check if guardians already exist
        const { data: existing } = await supabase
            .from('guardian_agents')
            .select('id')
            .eq('project_id', projectId)
            .limit(1);
        if (existing && existing.length > 0) {
            console.log('Guardians already initialized for project:', projectId);
            return;
        }
        const defaultGuardians = [
            {
                project_id: projectId,
                name: 'Database Guardian',
                guardian_type: 'database',
                enabled: true,
                can_auto_fix: false,
                rules: [],
                configuration: {
                    checkSchemaConsistency: true,
                    preventDuplicateTables: true,
                    validateMigrations: true,
                    ensureIndexesOnFK: true,
                    checkCascadeRules: true,
                },
                priority: 1,
            },
            {
                project_id: projectId,
                name: 'Architecture Guardian',
                guardian_type: 'architecture',
                enabled: true,
                can_auto_fix: false,
                rules: [],
                configuration: {
                    detectCircularDependencies: true,
                    enforceLayerBoundaries: true,
                    checkNamingConventions: true,
                    validateModuleStructure: true,
                },
                priority: 1,
            },
        ];
        const { error } = await supabase.from('guardian_agents').insert(defaultGuardians);
        if (error) {
            console.error('Error initializing default guardians:', error);
            throw error;
        }
        console.log('Default guardians initialized for project:', projectId);
    }
}
/**
 * Global guardian registry instance
 */
export const guardianRegistry = new GuardianRegistry();
/**
 * Helper function to run guardians on a task
 */
export async function runGuardiansOnTask(taskId, context) {
    const fullContext = {
        taskId,
        ...context,
    };
    return guardianRegistry.runAllGuardians(fullContext);
}
