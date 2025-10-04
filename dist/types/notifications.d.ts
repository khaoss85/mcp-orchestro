/**
 * Supported notification types
 */
export type NotificationType = 'task_created' | 'task_updated' | 'task_deleted' | 'feedback_received' | 'codebase_analyzed' | 'system_alert' | 'user_story_completed';
/**
 * Domain model for notifications (camelCase for application use)
 */
export interface Notification {
    id: string;
    projectId: string;
    taskId?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
/**
 * Input type for creating notifications (API request)
 */
export interface NotificationInput {
    projectId: string;
    taskId?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
}
/**
 * Database row type (snake_case for Supabase queries)
 */
export interface NotificationRow {
    id: string;
    project_id: string;
    task_id?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    is_read: boolean;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
/**
 * Response type for notification list queries
 */
export interface NotificationListResponse {
    notifications: Notification[];
    unreadCount: number;
    total: number;
}
/**
 * Converts a database row to a domain Notification object
 * @param row Database row from Supabase
 * @returns Domain Notification object with camelCase properties
 */
export declare function rowToNotification(row: NotificationRow): Notification;
/**
 * Converts a domain Notification object to a database row
 * @param notification Domain Notification object
 * @returns Database row with snake_case properties
 */
export declare function notificationToRow(notification: Notification): NotificationRow;
/**
 * Converts multiple database rows to domain Notification objects
 * @param rows Array of database rows
 * @returns Array of domain Notification objects
 */
export declare function rowsToNotifications(rows: NotificationRow[]): Notification[];
