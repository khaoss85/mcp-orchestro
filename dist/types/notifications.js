// Orchestro Notification System Types
// Types for notification objects, API requests/responses, and database rows
// ============================================
// CONVERSION HELPERS
// ============================================
/**
 * Converts a database row to a domain Notification object
 * @param row Database row from Supabase
 * @returns Domain Notification object with camelCase properties
 */
export function rowToNotification(row) {
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
export function notificationToRow(notification) {
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
export function rowsToNotifications(rows) {
    return rows.map(rowToNotification);
}
