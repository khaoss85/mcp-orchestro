// Orchestro Base Guardian Implementation
// Abstract base class for all guardian agents
export class BaseGuardian {
    name;
    guardianType;
    config;
    enabled;
    constructor(name, guardianType, config = {}, enabled = true) {
        this.name = name;
        this.guardianType = guardianType;
        this.config = config;
        this.enabled = enabled;
    }
    /**
     * Auto-fix method - optional, can be overridden
     */
    async autoFix(issue, context) {
        // Default implementation: no auto-fix
        console.log(`Auto-fix not implemented for ${this.name}`);
        return context;
    }
    /**
     * Check if guardian is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Helper: Create validation result
     */
    createValidation(type, message, details = {}, canBlock = false) {
        return {
            guardianName: this.name,
            validationType: type,
            message,
            details,
            canBlock,
        };
    }
    /**
     * Helper: Create warning
     */
    warning(message, details) {
        return this.createValidation('warning', message, details, false);
    }
    /**
     * Helper: Create error
     */
    error(message, details, canBlock = true) {
        return this.createValidation('error', message, details, canBlock);
    }
    /**
     * Helper: Create info
     */
    info(message, details) {
        return this.createValidation('info', message, details, false);
    }
    /**
     * Helper: Create fixed notification
     */
    fixed(message, details) {
        return this.createValidation('fixed', message, details, false);
    }
}
