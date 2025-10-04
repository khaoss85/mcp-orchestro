import { BaseGuardian } from './BaseGuardian.js';
import { GuardianRunContext, GuardianValidationResult, ArchitectureGuardianConfig } from '../../types/guardians.js';
export declare class ArchitectureGuardian extends BaseGuardian {
    private archConfig;
    constructor(config?: Partial<ArchitectureGuardianConfig>, enabled?: boolean);
    validate(context: GuardianRunContext): Promise<GuardianValidationResult[]>;
    private checkCircularDependencies;
    private checkLayerBoundaries;
    private checkNamingConventions;
    private checkModuleStructure;
}
