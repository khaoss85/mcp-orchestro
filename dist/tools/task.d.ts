export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    dependencies: string[];
    assignee?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    tags?: string[];
    userStoryId?: string | null;
    isUserStory: boolean;
    storyMetadata?: {
        complexity?: string;
        estimatedHours?: number;
        tags?: string[];
        originalStory?: string;
    };
    createdAt: string;
    updatedAt: string;
}
export declare function createTask(params: {
    title: string;
    description: string;
    status?: TaskStatus;
    dependencies?: string[];
    assignee?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    tags?: string[];
    userStoryId?: string | null;
    isUserStory?: boolean;
    storyMetadata?: any;
}): Promise<{
    success: boolean;
    task?: Task;
    error?: string;
}>;
export declare function listTasks(params?: {
    status?: TaskStatus;
}): Promise<Task[]>;
export declare function updateTask(params: {
    id: string;
    title?: string;
    description?: string;
    status?: TaskStatus;
    dependencies?: string[];
    assignee?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    tags?: string[];
}): Promise<{
    success: boolean;
    task?: Task;
    error?: string;
}>;
export declare function getTask(id: string): Promise<Task | undefined>;
export declare function deleteTask(id: string): Promise<{
    success: boolean;
    error?: string;
}>;
export interface TaskContext {
    task: Task;
    dependencies: Task[];
    dependents: Task[];
    relatedTasks: Task[];
    previousWork: string[];
    guidelines: string[];
    feedback: Array<{
        id: string;
        feedback: string;
        type: string;
        pattern: string;
        createdAt: string;
    }>;
    relatedLearnings: Array<{
        id: string;
        lesson: string;
        type?: string;
        pattern?: string;
    }>;
    techStack: {
        frontend?: string;
        backend?: string;
        database?: string;
        [key: string]: string | undefined;
    };
    analysis?: {
        files_to_modify: Array<{
            path: string;
            reason: string;
            risk: 'low' | 'medium' | 'high';
        }>;
        files_to_create: Array<{
            path: string;
            reason: string;
        }>;
        risks: Array<{
            level: 'low' | 'medium' | 'high';
            description: string;
            mitigation: string;
        }>;
        related_code: Array<{
            file: string;
            description: string;
            lines?: string;
        }>;
        recommendations: string[];
        analyzed_at?: string;
    };
}
export declare function getTaskContext(id: string): Promise<{
    success: boolean;
    context?: TaskContext;
    error?: string;
}>;
export declare function getUserStories(): Promise<Task[]>;
export declare function getTasksByUserStory(userStoryId: string): Promise<Task[]>;
