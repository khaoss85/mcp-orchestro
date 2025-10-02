export interface ProjectInfo {
    id: string;
    name: string;
    status: string;
    description?: string;
    created_at: string;
    updated_at: string;
}
export declare function getProjectInfo(): Promise<ProjectInfo>;
export declare function updateProjectStatus(status: string): Promise<ProjectInfo>;
