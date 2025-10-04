import { TechStack, SubAgent, MCPTool, ProjectGuideline, CodePattern, CompleteProjectConfig, TechStackInput, SubAgentInput, MCPToolInput, ProjectGuidelineInput, CodePatternInput } from '../types/configuration.js';
export declare function getProjectConfiguration(params: {
    projectId: string;
}): Promise<CompleteProjectConfig>;
export declare function addTechStack(params: {
    projectId: string;
    techStack: TechStackInput;
}): Promise<TechStack>;
export declare function updateTechStack(params: {
    id: string;
    updates: Partial<TechStackInput>;
}): Promise<TechStack>;
export declare function removeTechStack(params: {
    id: string;
}): Promise<{
    success: boolean;
}>;
export declare function addSubAgent(params: {
    projectId: string;
    subAgent: SubAgentInput;
}): Promise<SubAgent>;
export declare function updateSubAgent(params: {
    id: string;
    updates: Partial<SubAgentInput>;
}): Promise<SubAgent>;
export declare function addMCPTool(params: {
    projectId: string;
    tool: MCPToolInput;
}): Promise<MCPTool>;
export declare function updateMCPTool(params: {
    id: string;
    updates: Partial<MCPToolInput>;
}): Promise<MCPTool>;
export declare function addGuideline(params: {
    projectId: string;
    guideline: ProjectGuidelineInput;
}): Promise<ProjectGuideline>;
export declare function addCodePattern(params: {
    projectId: string;
    pattern: CodePatternInput;
}): Promise<CodePattern>;
export declare function initializeProjectConfiguration(params: {
    projectId: string;
}): Promise<{
    success: boolean;
    message: string;
}>;
