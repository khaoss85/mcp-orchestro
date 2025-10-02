export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    dependencies: string[];
    createdAt: string;
    updatedAt: string;
}
export declare function createTask(params: {
    title: string;
    description: string;
    status?: TaskStatus;
    dependencies?: string[];
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
}
export declare function getTaskContext(id: string): Promise<{
    success: boolean;
    context?: TaskContext;
    error?: string;
}>;
