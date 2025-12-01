// ============================================================================
// Cloud Functions - Unified Permissions System Types
// نظام الصلاحيات الموحد - الواجهات للـ Cloud Functions
// ============================================================================

import * as admin from "firebase-admin";

/**
 * نطاق موحد (Unified Scope)
 * يدعم فقط: الشركة والقسم
 *
 * ملاحظة: تم إزالة sections, sector, region
 * للحفاظ على البساطة والتوحيد
 */
export interface UnifiedScope {
  /** معرف الشركة - إلزامي */
  scope_company_id: string;

  /** معرف القسم - اختياري (null = جميع الأقسام في الشركة) */
  scope_department_id?: string | null;
}

/**
 * واجهة بيانات المورد (Resource Data)
 */
export interface ResourceData {
  service_id?: string;
  sub_service_id?: string;
  sub_sub_service_id?: string;

  /** النطاق الخاص بهذا المورد (company + department) */
  scope?: UnifiedScope;
}

/**
 * واجهة بيانات المستخدم
 */
export interface UserData {
  id: string;
  name_ar?: string;
  name_en?: string;
  job_id?: string;
  company_id?: string;
  department_id?: string;
  is_super_admin?: boolean;
  avatar_url?: string;
  [key: string]: unknown;
}

/**
 * واجهة ملف التفويض (Delegation Profile)
 */
export interface DelegationProfile {
  isSuperAdmin: boolean;

  /** قواعد الوصول من الوظيفة */
  accessRules: DelegationRule[];

  /** قواعد التحكم من الوظيفة */
  controlRules: DelegationRule[];

  /** استثناءات الوصول الشخصية */
  accessExceptions: DelegationRule[];

  /** استثناءات التحكم الشخصية */
  controlExceptions: DelegationRule[];

  /** الموارد المتاحة (service IDs) */
  resources: string[];

  /** آخر تحديث */
  last_updated: admin.firestore.FieldValue | admin.firestore.Timestamp;
}

/**
 * قاعدة تفويض (Delegation Rule)
 */
export interface DelegationRule extends UnifiedScope {
  /** معرف الشركة المستهدفة (اختياري) */
  target_company_id?: string | null;

  /** معرف الوظيفة المستهدفة (اختياري) */
  target_job_id?: string | null;

  /** معرف المستخدم المستهدف (اختياري) */
  target_user_id?: string | null;

  /** مقيد بالشركة فقط؟ */
  restricted_to_company?: boolean;
}

/**
 * واجهة بيانات الصلاحية (Permission Data)
 */
export interface PermissionData extends UnifiedScope {
  /** معرف الصلاحية */
  permission_id: string;

  /** هل الصلاحية مسموحة؟ */
  is_allowed: boolean;
}

/**
 * بيانات توزيع الوظائف (Job Distribution)
 */
export interface JobDistribution {
  job_id: string;
  company_id: string;
  department_id?: string | null;
}

/**
 * نتيجة استدعاء Cloud Function
 */
export interface CloudFunctionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

// ============================================================================
// Notification Types for Cloud Functions
// ============================================================================

/**
 * نوع التغيير في النظام
 */
export type ChangeType =
  | "permission_added"
  | "permission_removed"
  | "permission_modified"
  | "scope_added"
  | "scope_removed"
  | "scope_modified"
  | "resource_added"
  | "resource_removed"
  | "resource_modified";

/**
 * نظام التغيير
 */
export type SystemType =
  | "direct_permissions"
  | "access_delegation"
  | "control_delegation";

/**
 * مستوى التأثير
 */
export type ImpactLevel = "high" | "medium" | "low";

/**
 * واجهة التنبيه بالتغيير (للحفظ في Firestore)
 */
export interface PermissionChangeNotification {
  /** معرف فريد للتنبيه */
  id?: string;

  /** نوع التغيير */
  change_type: ChangeType;

  /** النظام المتأثر */
  system: SystemType;

  /** مستوى التأثير */
  impact_level: ImpactLevel;

  /** معرف المستخدم المتأثر */
  affected_user_id: string;

  /** معرف الوظيفة المتأثرة (إن وجد) */
  affected_job_id?: string;

  /** الرسالة التوضيحية */
  message: string;

  /** التفاصيل الإضافية */
  details?: {
    permission_id?: string;
    permission_name?: string;
    service_name?: string;
    scope?: UnifiedScope;
    old_value?: unknown;
    new_value?: unknown;
  };

  /** معرف المستخدم الذي قام بالتغيير */
  changed_by_user_id?: string;

  /** اسم المستخدم الذي قام بالتغيير */
  changed_by_name?: string;

  /** تاريخ التغيير */
  timestamp: admin.firestore.FieldValue | admin.firestore.Timestamp;

  /** هل تم قراءة التنبيه؟ */
  is_read?: boolean;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * نوع الإجراء (إضافة أو حذف)
 */
export type ActionType = "add" | "remove" | "delete";

/**
 * نوع الصلاحية
 */
export type PermissionType = "job" | "user";

/**
 * نوع التفويض
 */
export type DelegationType = "access" | "control";

/**
 * نوع الكيان
 */
export type EntityType = "scopes" | "resources";

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * التحقق من صحة النطاق
 */
export function validateScope(scope: UnifiedScope): boolean {
  if (!scope.scope_company_id) {
    return false;
  }

  // يمكن أن يكون department_id null أو string
  return true;
}

/**
 * التحقق من تطابق النطاق
 */
export function isScopeMatch(
  userScope: { company_id?: string; department_id?: string },
  ruleScope: UnifiedScope
): boolean {
  // التحقق من الشركة
  if (
    ruleScope.scope_company_id &&
    userScope.company_id !== ruleScope.scope_company_id
  ) {
    return false;
  }

  // التحقق من القسم (إذا كان محدداً في القاعدة)
  if (
    ruleScope.scope_department_id &&
    userScope.department_id !== ruleScope.scope_department_id
  ) {
    return false;
  }

  return true;
}

/**
 * دمج النطاقات (للحصول على النطاق الأكثر تقييداً)
 */
export function mergeScopes(
  scope1: UnifiedScope,
  scope2: UnifiedScope
): UnifiedScope {
  return {
    scope_company_id: scope1.scope_company_id || scope2.scope_company_id,
    scope_department_id:
      scope1.scope_department_id || scope2.scope_department_id
  };
}
