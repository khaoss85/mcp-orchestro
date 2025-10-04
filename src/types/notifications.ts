// Orchestro Notification System Types
// Types for notification objects, API requests/responses, and database rows

// ============================================
// NOTIFICATION TYPES
// ============================================

/**
 * Supported notification types
 */
export type NotificationType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'feedback_received'
  | 'codebase_analyzed'
  | 'system_alert'
  | 'user_story_completed';

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

// ============================================
// CONVERSION HELPERS
// ============================================

/**
 * Converts a database row to a domain Notification object
 * @param row Database row from Supabase
 * @returns Domain Notification object with camelCase properties
 */
export function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id ?? null,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Converts a domain Notification object to a database row
 * @param notification Domain Notification object
 * @returns Database row with snake_case properties
 */
export function notificationToRow(notification: Notification): NotificationRow {
  return {
    id: notification.id,
    project_id: notification.projectId,
    task_id: notification.taskId ?? null,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    is_read: notification.isRead,
    metadata: notification.metadata || {},
    created_at: notification.createdAt,
    updated_at: notification.updatedAt,
  };
}

/**
 * Converts multiple database rows to domain Notification objects
 * @param rows Array of database rows
 * @returns Array of domain Notification objects
 */
export function rowsToNotifications(rows: NotificationRow[]): Notification[] {
  return rows.map(rowToNotification);
}
