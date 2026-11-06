'use client';

import { AuditLogItem, AdminRole } from '@/types/admin';

const AUDIT_STORAGE_KEY = 'spades_admin_audit_logs_v1';

const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'aud-001',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    adminId: 'usr-chancellor',
    adminName: 'Chancellor (Admin)',
    adminRole: 'super_admin',
    eventType: 'PASSWORD_RESET_INITIATED',
    action: 'Initiated secure password reset workflow for user "Sarah Vinyl"',
    resource: 'Auth Security',
    resourceId: 'usr-sarah_vinyl',
    newValue: { delivery: 'Secure Link Dispatched', tokenMasked: 'tok_rst_***' },
    ip: '198.51.100.10',
    geo: 'Austin, TX, US',
    status: 'SUCCESS',
  },
  {
    id: 'aud-002',
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    adminId: 'usr-chancellor',
    adminName: 'Chancellor (Admin)',
    adminRole: 'super_admin',
    eventType: 'PERMISSIONS_CHANGED',
    action: 'Promoted user "Marcus Drumhead" to Analytics Administrator',
    resource: 'Roles & Permissions',
    resourceId: 'usr-marcus_drum',
    previousValue: { role: 'user' },
    newValue: { role: 'analytics_admin' },
    ip: '198.51.100.10',
    geo: 'Austin, TX, US',
    status: 'SUCCESS',
  },
  {
    id: 'aud-003',
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    adminId: 'usr-chancellor',
    adminName: 'Chancellor (Admin)',
    adminRole: 'super_admin',
    eventType: 'USER_SUSPENDED',
    action: 'Suspended user account "Alex Weber" due to policy violation review',
    resource: 'User Management',
    resourceId: 'usr-alex_berlin',
    previousValue: { status: 'active' },
    newValue: { status: 'suspended', reason: 'Abuse flag review' },
    ip: '198.51.100.10',
    geo: 'Austin, TX, US',
    status: 'WARNING',
  },
  {
    id: 'aud-004',
    timestamp: new Date(Date.now() - 240 * 60000).toISOString(),
    adminId: 'usr-sarah_vinyl',
    adminName: 'Sarah Vinyl Crate',
    adminRole: 'content_admin',
    eventType: 'CATALOG_SYNCED',
    action: 'Synchronized breakbeat catalog with Firestore master collection spadesworks8',
    resource: 'Catalog System',
    resourceId: 'catalog-v1',
    newValue: { tracksSynced: 12, albumsSynced: 4, videosSynced: 6 },
    ip: '203.0.113.88',
    geo: 'London, UK',
    status: 'SUCCESS',
  },
  {
    id: 'aud-005',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    adminId: 'usr-chancellor',
    adminName: 'Chancellor (Admin)',
    adminRole: 'super_admin',
    eventType: 'SETTINGS_CHANGED',
    action: 'Updated real-time telemetry streaming retention to 90 days',
    resource: 'System Configuration',
    resourceId: 'sys-retention',
    previousValue: { retentionDays: 30 },
    newValue: { retentionDays: 90 },
    ip: '198.51.100.10',
    geo: 'Austin, TX, US',
    status: 'SUCCESS',
  },
  {
    id: 'aud-006',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    adminId: 'usr-chancellor',
    adminName: 'Chancellor (Admin)',
    adminRole: 'super_admin',
    eventType: 'MERCH_MODIFIED',
    action: 'Updated inventory count for "Return of the Break Beats Heavyweight Hoodie"',
    resource: 'Merchandise Store',
    resourceId: 'prod-hoodie-1',
    previousValue: { inventory: 80 },
    newValue: { inventory: 150 },
    ip: '198.51.100.10',
    geo: 'Austin, TX, US',
    status: 'SUCCESS',
  },
];

class AuditLoggerClass {
  private logs: AuditLogItem[] = [];
  private listeners: Set<(logs: AuditLogItem[]) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadLogs();
    }
  }

  private loadLogs() {
    try {
      const saved = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.logs = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Error loading audit logs from storage:', e);
    }
    this.logs = [...INITIAL_AUDIT_LOGS];
    this.persistLogs();
  }

  private persistLogs() {
    if (typeof window === 'undefined') return;
    try {
      if (this.logs.length > 50) {
        this.logs = this.logs.slice(0, 50);
      }
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Failed to persist audit logs, capping to safe limit:', e);
      try {
        this.logs = this.logs.slice(0, 15);
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this.logs));
      } catch {}
    }
  }

  public subscribe(callback: (logs: AuditLogItem[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb([...this.logs]);
      } catch (err) {
        console.error('Audit logger listener error:', err);
      }
    });
  }

  public getLogs(): AuditLogItem[] {
    return [...this.logs];
  }

  public logAction(logData: {
    adminId: string;
    adminName: string;
    adminRole: AdminRole;
    eventType: string;
    action: string;
    resource: string;
    resourceId?: string;
    previousValue?: string | Record<string, any>;
    newValue?: string | Record<string, any>;
    ip?: string;
    geo?: string;
    status?: 'SUCCESS' | 'WARNING' | 'FAILED';
    details?: string;
  }): AuditLogItem {
    const newLog: AuditLogItem = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      adminId: logData.adminId,
      adminName: logData.adminName,
      adminRole: logData.adminRole,
      eventType: logData.eventType,
      action: logData.action,
      resource: logData.resource,
      resourceId: logData.resourceId,
      previousValue: logData.previousValue,
      newValue: logData.newValue,
      ip: logData.ip || '198.51.100.10',
      geo: logData.geo || 'Austin, TX, US',
      status: logData.status || 'SUCCESS',
      details: logData.details,
    };

    this.logs.unshift(newLog);
    this.persistLogs();
    this.notify();
    return newLog;
  }

  public searchLogs(query: string, eventTypeFilter?: string, statusFilter?: string): AuditLogItem[] {
    return this.logs.filter((l) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !query ||
        l.action.toLowerCase().includes(q) ||
        l.adminName.toLowerCase().includes(q) ||
        l.resource.toLowerCase().includes(q) ||
        l.eventType.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q);

      const matchesType = !eventTypeFilter || eventTypeFilter === 'all' || l.eventType === eventTypeFilter;
      const matchesStatus = !statusFilter || statusFilter === 'all' || l.status === statusFilter;

      return matchesQuery && matchesType && matchesStatus;
    });
  }

  public exportLogsToCSV(): string {
    const headers = ['Event ID', 'Timestamp (UTC)', 'Admin ID', 'Admin Name', 'Role', 'Event Type', 'Action', 'Resource', 'Resource ID', 'IP Address', 'Geo Location', 'Status'];
    const rows = this.logs.map((l) => [
      l.id,
      l.timestamp,
      l.adminId,
      `"${l.adminName.replace(/"/g, '""')}"`,
      l.adminRole,
      l.eventType,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.resource.replace(/"/g, '""')}"`,
      l.resourceId || '',
      l.ip,
      `"${l.geo.replace(/"/g, '""')}"`,
      l.status,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public exportLogsToJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const AuditLogger = new AuditLoggerClass();
