import { BaseGuardian } from './BaseGuardian.js';
import { GuardianRunContext, GuardianValidationResult, DatabaseGuardianConfig } from '../../types/guardians.js';
export declare class DatabaseGuardian extends BaseGuardian {
    private dbConfig;
    constructor(config?: Partial<DatabaseGuardianConfig>, enabled?: boolean);
    validate(context: GuardianRunContext): Promise<GuardianValidationResult[]>;
    private checkDuplicateTables;
    private validateMigrations;
    private checkForeignKeyIndexes;
    private checkCascadeRules;
}
