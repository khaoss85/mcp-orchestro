import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs/promises';
import fg from 'fast-glob';
import { simpleGit } from 'simple-git';
import { getSupabaseClient } from '../db/supabase.js';
import { emitEvent } from '../db/eventQueue.js';
/**
 * Analyze entire codebase and store results in database
 */
export async function analyzeCodebase(rootPath, includeGitHistory = false) {
    const startTime = Date.now();
    const supabase = getSupabaseClient();
    try {
        // Find all TypeScript/JavaScript files
        const files = await fg(['**/*.{ts,tsx,js,jsx}'], {
            cwd: rootPath,
            ignore: ['node_modules/**', 'dist/**', '.next/**', 'build/**', 'coverage/**'],
            absolute: true,
        });
        let totalEntities = 0;
        let totalDeps = 0;
        const entityMap = new Map(); // entity key -> entity id
        // Process each file
        for (const filePath of files) {
            const relativePath = path.relative(rootPath, filePath);
            // Upsert resource node for file
            const { data: resourceNode, error: resourceError } = await supabase
                .from('resource_nodes')
                .upsert({
                type: 'file',
                name: relativePath,
                path: filePath,
            }, {
                onConflict: 'type,name',
                ignoreDuplicates: false,
            })
                .select()
                .single();
            if (resourceError || !resourceNode) {
                console.error(`Failed to upsert resource node for ${relativePath}:`, resourceError);
                continue;
            }
            // Parse file and extract entities
            const entities = await extractEntitiesFromFile(filePath, resourceNode.id);
            // Store entities
            for (const entity of entities) {
                const { data: storedEntity, error: entityError } = await supabase
                    .from('code_entities')
                    .upsert(entity, {
                    onConflict: 'resource_id,name,type',
                    ignoreDuplicates: false,
                })
                    .select()
                    .single();
                if (entityError || !storedEntity) {
                    console.error(`Failed to store entity ${entity.name}:`, entityError);
                    continue;
                }
                const entityKey = `${filePath}:${entity.name}:${entity.type}`;
                entityMap.set(entityKey, storedEntity.id);
                totalEntities++;
            }
            // Extract dependencies (imports)
            const dependencies = await extractDependenciesFromFile(filePath, rootPath);
            totalDeps += dependencies.length;
            // Store git history if requested
            if (includeGitHistory) {
                try {
                    const history = await getFileGitHistory(rootPath, relativePath);
                    for (const entry of history) {
                        await supabase.from('file_history').upsert({
                            resource_id: resourceNode.id,
                            ...entry,
                        }, {
                            onConflict: 'resource_id,commit_hash',
                            ignoreDuplicates: true,
                        });
                    }
                }
                catch (gitError) {
                    console.warn(`Git history unavailable for ${relativePath}:`, gitError);
                }
            }
        }
        const duration = Date.now() - startTime;
        // Store analysis metadata
        const { data: project } = await supabase.from('projects').select('id').single();
        if (project) {
            await supabase.from('codebase_analysis').upsert({
                project_id: project.id,
                root_path: rootPath,
                total_files: files.length,
                total_entities: totalEntities,
                total_dependencies: totalDeps,
                analysis_duration_ms: duration,
                completed_at: new Date().toISOString(),
            }, {
                onConflict: 'project_id',
                ignoreDuplicates: false,
            });
        }
        // Emit real-time event
        await emitEvent('codebase_analyzed', {
            total_files: files.length,
            total_entities: totalEntities,
            total_dependencies: totalDeps,
            duration_ms: duration,
        });
        return {
            success: true,
            total_files: files.length,
            total_entities: totalEntities,
            total_dependencies: totalDeps,
            analysis_duration_ms: duration,
        };
    }
    catch (error) {
        return {
            success: false,
            total_files: 0,
            total_entities: 0,
            total_dependencies: 0,
            analysis_duration_ms: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * Extract code entities from a TypeScript/JavaScript file
 */
async function extractEntitiesFromFile(filePath, resourceId) {
    const entities = [];
    try {
        const sourceCode = await fs.readFile(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
        const visit = (node) => {
            // Extract functions
            if (ts.isFunctionDeclaration(node) && node.name) {
                entities.push(extractFunction(node, sourceFile, resourceId));
            }
            // Extract arrow functions assigned to variables
            if (ts.isVariableStatement(node)) {
                node.declarationList.declarations.forEach((decl) => {
                    if (decl.initializer &&
                        (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
                        if (ts.isIdentifier(decl.name)) {
                            entities.push(extractFunctionVariable(decl, sourceFile, resourceId));
                        }
                    }
                });
            }
            // Extract classes
            if (ts.isClassDeclaration(node) && node.name) {
                entities.push(extractClass(node, sourceFile, resourceId));
            }
            // Extract interfaces
            if (ts.isInterfaceDeclaration(node)) {
                entities.push(extractInterface(node, sourceFile, resourceId));
            }
            // Extract type aliases
            if (ts.isTypeAliasDeclaration(node)) {
                entities.push(extractTypeAlias(node, sourceFile, resourceId));
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }
    catch (error) {
        console.error(`Failed to parse ${filePath}:`, error);
    }
    return entities;
}
/**
 * Extract function declaration
 */
function extractFunction(node, sourceFile, resourceId) {
    const name = node.name?.getText(sourceFile) || 'anonymous';
    const { line: startLine, character: startColumn } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const isExported = hasExportModifier(node);
    const signature = node.getText(sourceFile).split('{')[0].trim();
    const documentation = getJsDocComment(node, sourceFile);
    const complexity = calculateCyclomaticComplexity(node);
    const loc = endLine - startLine + 1;
    // Check if it's a React component
    const isComponent = isReactComponent(node, sourceFile);
    return {
        resource_id: resourceId,
        type: isComponent ? 'component' : 'function',
        name,
        signature,
        location: {
            startLine: startLine + 1,
            endLine: endLine + 1,
            startColumn,
            endColumn,
        },
        documentation,
        exported: isExported,
        metrics: {
            cyclomatic: complexity,
            loc,
            maintainability: calculateMaintainability(complexity, loc),
        },
    };
}
/**
 * Extract function from variable declaration
 */
function extractFunctionVariable(decl, sourceFile, resourceId) {
    const name = decl.name.getText(sourceFile);
    const { line: startLine, character: startColumn } = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(decl.getEnd());
    const parent = decl.parent?.parent;
    const isExported = parent && ts.isVariableStatement(parent) && hasExportModifier(parent);
    const signature = decl.getText(sourceFile).split('{')[0].trim();
    const complexity = decl.initializer ? calculateCyclomaticComplexity(decl.initializer) : 1;
    const loc = endLine - startLine + 1;
    const isComponent = decl.initializer && isReactComponent(decl.initializer, sourceFile);
    return {
        resource_id: resourceId,
        type: isComponent ? 'component' : 'function',
        name,
        signature,
        location: {
            startLine: startLine + 1,
            endLine: endLine + 1,
            startColumn,
            endColumn,
        },
        exported: isExported,
        metrics: {
            cyclomatic: complexity,
            loc,
            maintainability: calculateMaintainability(complexity, loc),
        },
    };
}
/**
 * Extract class declaration
 */
function extractClass(node, sourceFile, resourceId) {
    const name = node.name?.getText(sourceFile) || 'AnonymousClass';
    const { line: startLine, character: startColumn } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const isExported = hasExportModifier(node);
    const documentation = getJsDocComment(node, sourceFile);
    const loc = endLine - startLine + 1;
    // Calculate complexity as sum of all method complexities
    let totalComplexity = 0;
    node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member)) {
            totalComplexity += calculateCyclomaticComplexity(member);
        }
    });
    return {
        resource_id: resourceId,
        type: 'class',
        name,
        location: {
            startLine: startLine + 1,
            endLine: endLine + 1,
            startColumn,
            endColumn,
        },
        documentation,
        exported: isExported,
        metrics: {
            cyclomatic: totalComplexity,
            loc,
            maintainability: calculateMaintainability(totalComplexity, loc),
        },
    };
}
/**
 * Extract interface declaration
 */
function extractInterface(node, sourceFile, resourceId) {
    const name = node.name.getText(sourceFile);
    const { line: startLine, character: startColumn } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const isExported = hasExportModifier(node);
    const signature = node.getText(sourceFile);
    const documentation = getJsDocComment(node, sourceFile);
    return {
        resource_id: resourceId,
        type: 'interface',
        name,
        signature,
        location: {
            startLine: startLine + 1,
            endLine: endLine + 1,
            startColumn,
            endColumn,
        },
        documentation,
        exported: isExported,
        metrics: {},
    };
}
/**
 * Extract type alias
 */
function extractTypeAlias(node, sourceFile, resourceId) {
    const name = node.name.getText(sourceFile);
    const { line: startLine, character: startColumn } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const isExported = hasExportModifier(node);
    const signature = node.getText(sourceFile);
    return {
        resource_id: resourceId,
        type: 'type',
        name,
        signature,
        location: {
            startLine: startLine + 1,
            endLine: endLine + 1,
            startColumn,
            endColumn,
        },
        exported: isExported,
        metrics: {},
    };
}
/**
 * Calculate cyclomatic complexity
 */
function calculateCyclomaticComplexity(node) {
    let complexity = 1; // Base complexity
    function visit(n) {
        if (ts.isIfStatement(n))
            complexity++;
        if (ts.isForStatement(n))
            complexity++;
        if (ts.isForInStatement(n))
            complexity++;
        if (ts.isForOfStatement(n))
            complexity++;
        if (ts.isWhileStatement(n))
            complexity++;
        if (ts.isDoStatement(n))
            complexity++;
        if (ts.isCaseClause(n))
            complexity++;
        if (ts.isConditionalExpression(n))
            complexity++;
        if (ts.isCatchClause(n))
            complexity++;
        if (ts.isBinaryExpression(n)) {
            if (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                n.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
                n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
                complexity++;
            }
        }
        ts.forEachChild(n, visit);
    }
    visit(node);
    return complexity;
}
/**
 * Calculate maintainability index (simplified)
 */
function calculateMaintainability(complexity, loc) {
    // Simplified maintainability index (0-100)
    // Based on Halstead volume and cyclomatic complexity
    const volume = Math.max(1, Math.log2(loc));
    const maintainability = Math.max(0, (171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(loc)) * 100 / 171);
    return Math.round(maintainability);
}
/**
 * Check if node has export modifier
 */
function hasExportModifier(node) {
    if (!('modifiers' in node) || !node.modifiers)
        return false;
    const modifiers = node.modifiers;
    return modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword ||
        mod.kind === ts.SyntaxKind.DefaultKeyword);
}
/**
 * Get JSDoc comment for node
 */
function getJsDocComment(node, sourceFile) {
    const jsDoc = node.jsDoc;
    if (jsDoc && jsDoc.length > 0) {
        return jsDoc[0].comment;
    }
    return undefined;
}
/**
 * Check if function/component is a React component
 */
function isReactComponent(node, sourceFile) {
    const text = node.getText(sourceFile);
    // Simple heuristic: contains JSX or returns JSX
    return text.includes('return <') || text.includes('React.createElement') || /return \(\s*</.test(text);
}
/**
 * Extract import dependencies from file
 */
async function extractDependenciesFromFile(filePath, rootPath) {
    const dependencies = [];
    try {
        const sourceCode = await fs.readFile(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
        const visit = (node) => {
            // Extract import statements
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier;
                if (ts.isStringLiteral(moduleSpecifier)) {
                    const importPath = moduleSpecifier.text;
                    // Resolve relative imports
                    if (importPath.startsWith('.')) {
                        const resolvedPath = path.resolve(path.dirname(filePath), importPath);
                        dependencies.push({
                            from: path.relative(rootPath, filePath),
                            to: path.relative(rootPath, resolvedPath),
                            type: 'import',
                        });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }
    catch (error) {
        console.error(`Failed to extract dependencies from ${filePath}:`, error);
    }
    return dependencies;
}
/**
 * Get git history for a file
 */
async function getFileGitHistory(rootPath, relativePath) {
    const git = simpleGit(rootPath);
    const history = [];
    try {
        const log = await git.log({ file: relativePath, maxCount: 50 });
        for (const commit of log.all) {
            const diff = await git.diffSummary([`${commit.hash}^`, commit.hash, '--', relativePath]);
            history.push({
                commit_hash: commit.hash,
                author: commit.author_name,
                date: new Date(commit.date),
                message: commit.message,
                insertions: diff.insertions,
                deletions: diff.deletions,
            });
        }
    }
    catch (error) {
        // File might be new or git not initialized
        console.warn(`Could not get git history for ${relativePath}`);
    }
    return history;
}
/**
 * Get entity by ID with health score
 */
export async function getEntityWithHealth(entityId) {
    const supabase = getSupabaseClient();
    const { data: entity, error } = await supabase
        .from('code_entities')
        .select('*, resource_nodes(*)')
        .eq('id', entityId)
        .single();
    if (error || !entity) {
        throw new Error(`Entity not found: ${entityId}`);
    }
    // Calculate health using database function
    const { data: healthData } = await supabase.rpc('get_entity_health', {
        entity_id: entityId,
    });
    return {
        ...entity,
        health: healthData || 85,
    };
}
/**
 * Get impact analysis for an entity
 */
export async function getEntityImpact(entityId) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_entity_impact', {
        entity_id: entityId,
    });
    if (error) {
        throw new Error(`Failed to get impact analysis: ${error.message}`);
    }
    return data || [];
}
/**
 * Get codebase tree structure
 */
export async function getCodebaseTree() {
    const supabase = getSupabaseClient();
    const { data: files, error } = await supabase
        .from('resource_nodes')
        .select('*, code_entities(*)')
        .eq('type', 'file')
        .order('name');
    if (error) {
        throw new Error(`Failed to fetch codebase tree: ${error.message}`);
    }
    // Build hierarchical tree structure
    const tree = {};
    files?.forEach((file) => {
        const parts = file.name.split('/');
        let current = tree;
        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                // Leaf node (file)
                current[part] = {
                    type: 'file',
                    id: file.id,
                    entities: file.code_entities || [],
                    path: file.name,
                };
            }
            else {
                // Directory node
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
        });
    });
    return tree;
}
