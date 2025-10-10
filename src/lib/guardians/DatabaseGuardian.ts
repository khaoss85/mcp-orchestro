// Orchestro Database Guardian
// Ensures database schema consistency and prevents issues

import { BaseGuardian } from './BaseGuardian.js';
import {
  GuardianRunContext,
  GuardianValidationResult,
  DatabaseGuardianConfig,
} from '../../types/guardians.js';
import { getSupabaseClient } from '../../db/supabase.js';

export class DatabaseGuardian extends BaseGuardian {
  private dbConfig: DatabaseGuardianConfig;

  constructor(config: Partial<DatabaseGuardianConfig> = {}, enabled: boolean = true) {
    super('Database Guardian', 'database', config, enabled);
    this.dbConfig = {
      checkSchemaConsistency: config.checkSchemaConsistency ?? true,
      preventDuplicateTables: config.preventDuplicateTables ?? true,
      validateMigrations: config.validateMigrations ?? true,
      ensureIndexesOnFK: config.ensureIndexesOnFK ?? true,
      checkCascadeRules: config.checkCascadeRules ?? true,
    };
  }

  async validate(context: GuardianRunContext): Promise<GuardianValidationResult[]> {
    const results: GuardianValidationResult[] = [];

    if (!this.isEnabled()) {
      return results;
    }

    // Check for duplicate tables in migrations
    if (this.dbConfig.preventDuplicateTables) {
      const duplicateCheck = await this.checkDuplicateTables(context);
      results.push(...duplicateCheck);
    }

    // Validate migration syntax
    if (this.dbConfig.validateMigrations) {
      const migrationCheck = await this.validateMigrations(context);
      results.push(...migrationCheck);
    }

    // Check foreign key indexes
    if (this.dbConfig.ensureIndexesOnFK) {
      const indexCheck = await this.checkForeignKeyIndexes(context);
      results.push(...indexCheck);
    }

    // Check cascade rules
    if (this.dbConfig.checkCascadeRules) {
      const cascadeCheck = await this.checkCascadeRules(context);
      results.push(...cascadeCheck);
    }

    return results;
  }

  private async checkDuplicateTables(
    context: GuardianRunContext
  ): Promise<GuardianValidationResult[]> {
    const results: GuardianValidationResult[] = [];

    // Check if creating tables that already exist
    const createTablePattern = /CREATE TABLE (?:IF NOT EXISTS )?([\w_]+)/gi;
    const filesToCheck = [
      ...(context.filesToCreate || []),
      ...(context.filesToModify || []),
    ];

    for (const file of filesToCheck) {
      if (file.toLowerCase().includes('migration') || file.toLowerCase().includes('.sql')) {
        // In a real implementation, we would read the file content
        // For now, we'll just add a placeholder check
        results.push(
          this.info(`Migration file detected: ${file}`, {
            recommendation: 'Ensure no duplicate tables are created',
          })
        );
      }
    }

    return results;
  }

  private async validateMigrations(
    context: GuardianRunContext
  ): Promise<GuardianValidationResult[]> {
    const results: GuardianValidationResult[] = [];

    // Check for common migration issues
    const migrationFiles = [
      ...(context.filesToCreate || []),
      ...(context.filesToModify || []),
    ].filter(f => f.toLowerCase().includes('migration') || f.toLowerCase().includes('.sql'));

    if (migrationFiles.length > 0) {
      results.push(
        this.info('Migration files detected', {
          files: migrationFiles,
          recommendation: 'Validate SQL syntax and test migrations before applying',
        })
      );
    }

    return results;
  }

  private async checkForeignKeyIndexes(
    context: GuardianRunContext
  ): Promise<GuardianValidationResult[]> {
    const results: GuardianValidationResult[] = [];

    // This would check if foreign keys have corresponding indexes
    // For now, just a placeholder
    results.push(
      this.info('Checking foreign key indexes', {
        recommendation: 'Ensure all foreign keys have corresponding indexes for performance',
      })
    );

    return results;
  }

  private async checkCascadeRules(
    context: GuardianRunContext
  ): Promise<GuardianValidationResult[]> {
    const results: GuardianValidationResult[] = [];

    // Check for proper CASCADE rules
    results.push(
      this.info('Checking cascade rules', {
        recommendation:
          'Ensure CASCADE/SET NULL/RESTRICT rules are appropriate for your data model',
      })
    );

    return results;
  }
}
