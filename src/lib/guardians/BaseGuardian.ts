// Orchestro Base Guardian Implementation
// Abstract base class for all guardian agents

import {
  IGuardian,
  GuardianType,
  GuardianRunContext,
  GuardianValidationResult,
  ValidationLevel,
} from '../../types/guardians.js';

export abstract class BaseGuardian implements IGuardian {
  constructor(
    public readonly name: string,
    public readonly guardianType: GuardianType,
    protected config: Record<string, any> = {},
    protected enabled: boolean = true
  ) {}

  /**
   * Main validation method - to be implemented by each guardian
   */
  abstract validate(context: GuardianRunContext): Promise<GuardianValidationResult[]>;

  /**
   * Auto-fix method - optional, can be overridden
   */
  async autoFix(
    issue: GuardianValidationResult,
    context: GuardianRunContext
  ): Promise<GuardianRunContext> {
    // Default implementation: no auto-fix
    console.log(`Auto-fix not implemented for ${this.name}`);
    return context;
  }

  /**
   * Check if guardian is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Helper: Create validation result
   */
  protected createValidation(
    type: ValidationLevel,
    message: string,
    details: Record<string, any> = {},
    canBlock: boolean = false
  ): GuardianValidationResult {
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
  protected warning(message: string, details?: Record<string, any>): GuardianValidationResult {
    return this.createValidation('warning', message, details, false);
  }

  /**
   * Helper: Create error
   */
  protected error(
    message: string,
    details?: Record<string, any>,
    canBlock: boolean = true
  ): GuardianValidationResult {
    return this.createValidation('error', message, details, canBlock);
  }

  /**
   * Helper: Create info
   */
  protected info(message: string, details?: Record<string, any>): GuardianValidationResult {
    return this.createValidation('info', message, details, false);
  }

  /**
   * Helper: Create fixed notification
   */
  protected fixed(message: string, details?: Record<string, any>): GuardianValidationResult {
    return this.createValidation('fixed', message, details, false);
  }
}
