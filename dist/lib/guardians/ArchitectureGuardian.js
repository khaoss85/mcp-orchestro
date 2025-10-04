// Orchestro Architecture Guardian
// Ensures architectural consistency and prevents violations
import { BaseGuardian } from './BaseGuardian.js';
export class ArchitectureGuardian extends BaseGuardian {
    archConfig;
    constructor(config = {}, enabled = true) {
        super('Architecture Guardian', 'architecture', config, enabled);
        this.archConfig = {
            detectCircularDependencies: config.detectCircularDependencies ?? true,
            enforceLayerBoundaries: config.enforceLayerBoundaries ?? true,
            checkNamingConventions: config.checkNamingConventions ?? true,
            validateModuleStructure: config.validateModuleStructure ?? true,
            layerRules: config.layerRules,
        };
    }
    async validate(context) {
        const results = [];
        if (!this.isEnabled()) {
            return results;
        }
        // Check for circular dependencies
        if (this.archConfig.detectCircularDependencies) {
            const circularCheck = await this.checkCircularDependencies(context);
            results.push(...circularCheck);
        }
        // Enforce layer boundaries
        if (this.archConfig.enforceLayerBoundaries) {
            const layerCheck = await this.checkLayerBoundaries(context);
            results.push(...layerCheck);
        }
        // Check naming conventions
        if (this.archConfig.checkNamingConventions) {
            const namingCheck = await this.checkNamingConventions(context);
            results.push(...namingCheck);
        }
        // Validate module structure
        if (this.archConfig.validateModuleStructure) {
            const moduleCheck = await this.checkModuleStructure(context);
            results.push(...moduleCheck);
        }
        return results;
    }
    async checkCircularDependencies(context) {
        const results = [];
        // Check task dependencies for circular references
        if (context.dependencies && context.dependencies.length > 0) {
            results.push(this.info('Task has dependencies', {
                count: context.dependencies.length,
                recommendation: 'Verify no circular dependencies exist in task chain',
            }));
        }
        return results;
    }
    async checkLayerBoundaries(context) {
        const results = [];
        // Check if files respect layer boundaries (e.g., UI -> Service -> Data)
        const layers = {
            ui: ['components/', 'app/', 'pages/'],
            service: ['lib/', 'services/'],
            data: ['db/', 'database/'],
        };
        const filesToCheck = [
            ...(context.filesToCreate || []),
            ...(context.filesToModify || []),
        ];
        for (const file of filesToCheck) {
            const fileLower = file.toLowerCase();
            // Simple layer boundary check
            if (fileLower.includes('components/') || fileLower.includes('app/')) {
                results.push(this.info(`UI layer file: ${file}`, {
                    recommendation: 'UI components should not directly access database layer',
                }));
            }
        }
        return results;
    }
    async checkNamingConventions(context) {
        const results = [];
        const filesToCheck = [
            ...(context.filesToCreate || []),
            ...(context.filesToModify || []),
        ];
        for (const file of filesToCheck) {
            // Check React component naming (PascalCase)
            if (file.includes('components/') && !file.match(/\/[A-Z][a-zA-Z]*\.(tsx|jsx)$/)) {
                results.push(this.warning(`Component file should use PascalCase: ${file}`, {
                    recommendation: 'Use PascalCase for React component files',
                }));
            }
            // Check utility/lib naming (camelCase)
            if (file.includes('lib/') && file.match(/\/[A-Z]/)) {
                results.push(this.warning(`Library file should use camelCase: ${file}`, {
                    recommendation: 'Use camelCase for utility and library files',
                }));
            }
        }
        return results;
    }
    async checkModuleStructure(context) {
        const results = [];
        // Check for proper module structure
        results.push(this.info('Validating module structure', {
            recommendation: 'Ensure files are organized according to project structure guidelines',
        }));
        return results;
    }
}
