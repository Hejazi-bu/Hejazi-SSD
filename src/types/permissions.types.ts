// ============================================================================
// Unified Permissions System Types
// نظام الصلاحيات الموحد - الواجهات المشتركة
// ============================================================================

/**
 * نطاق موحد (Unified Scope)
 * يدعم فقط: الشركة والقسم
 *
 * ملاحظة: تم إزالة sections, sector, region, management
 * للحفاظ على البساطة والتوحيد
 */
export interface UnifiedScope {
  /** معرف الشركة - إلزامي */
  company_id: string;

  /** معرف القسم - اختياري (null = جميع الأقسام في الشركة) */
  department_id?: string | null;
}

/**
 * نطاق مرن (للبحث والاستعلام)
 * يسمح باستخدام arrays للشركات والأقسام
 */
export interface FlexibleScope {
  /** مصفوفة معرفات الشركات (empty = جميع الشركات) */
  companies?: string[];

  /** مصفوفة معرفات الأقسام (empty = جميع الأقسام) */
  departments?: string[];
}

/**
 * واجهة الصلاحية المباشرة (Direct Permission)
 * النظام الأول: الصلاحيات المباشرة
 */
export interface DirectPermission {
  /** معرف الصلاحية */
  id: string;

  /** هل الصلاحية مسموحة؟ */
  is_allowed: boolean;

  /** النطاق الخاص بهذه الصلاحية (اختياري) */
  scope?: UnifiedScope;
}

/**
 * واجهة المورد (Resource)
 * تستخدم في أنظمة التفويض (Access & Control)
 */
export interface ResourceDefinition {
  /** معرف الخدمة الرئيسية */
  service_id?: string;

  /** معرف الخدمة الفرعية */
  sub_service_id?: string;

  /** معرف الخدمة الفرعية من المستوى الثاني */
  sub_sub_service_id?: string;

  /** النطاق الخاص بهذا المورد (company + department) */
  scope?: UnifiedScope;
}

/**
 * واجهة نطاق التفويض (Delegation Scope)
 * تستخدم في Access/Control Scopes لتحديد "من" يمكن الوصول إليهم
 */
export interface DelegationScopePayload {
  // === الهدف (Target) ===
  /** معرف الشركة المستهدفة */
  target_company_id?: string | null;

  /** معرف الوظيفة المستهدفة */
  target_job_id?: string | null;

  /** معرف المستخدم المستهدف */
  target_user_id?: string | null;

  // === النطاق الممنوح (Granted Scope) ===
  /** الشركة الممنوحة */
  scope_company_id?: string | null;

  /** القسم الممنوح */
  scope_department_id?: string | null;

  /** مقيد بالشركة فقط؟ */
  restricted_to_company?: boolean;
}

// ============================================================================
// Real-time Notification Types
// أنواع التنبيهات في الوقت الفعلي
// ============================================================================

/**
 * نوع التغيير في النظام
 */
export type ChangeType =
  | 'permission_added'      // تمت إضافة صلاحية
  | 'permission_removed'    // تمت إزالة صلاحية
  | 'permission_modified'   // تم تعديل صلاحية
  | 'scope_added'           // تمت إضافة نطاق
  | 'scope_removed'         // تمت إزالة نطاق
  | 'scope_modified'        // تم تعديل نطاق
  | 'resource_added'        // تمت إضافة مورد
  | 'resource_removed'      // تمت إزالة مورد
  | 'resource_modified';    // تم تعديل مورد

/**
 * نظام التغيير
 */
export type SystemType =
  | 'direct_permissions'    // النظام الأول: الصلاحيات المباشرة
  | 'access_delegation'     // النظام الثاني: تفويض الوصول
  | 'control_delegation';   // النظام الثالث: تفويض التحكم

/**
 * مستوى التأثير
 */
export type ImpactLevel = 'high' | 'medium' | 'low';

/**
 * واجهة التنبيه بالتغيير
 */
export interface PermissionChangeNotification {
  /** معرف فريد للتنبيه */
  id: string;

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
  timestamp: Date | admin.firestore.Timestamp;

  /** هل تم قراءة التنبيه؟ */
  is_read?: boolean;
}

/**
 * واجهة المستخدم المتأثر بالتغيير
 */
export interface AffectedUser {
  user_id: string;
  job_id?: string;
  notification: PermissionChangeNotification;
}

// ============================================================================
// Utility Types
// الأنواع المساعدة
// ============================================================================

/**
 * نتيجة استدعاء Cloud Function
 */
export interface CloudFunctionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * بيانات توزيع الوظائف
 */
export interface JobDistribution {
  job_id: string;
  company_id: string;
  department_id?: string | null;
}

// ============================================================================
// Export convenience types
// ============================================================================

/** نوع الإجراء (إضافة أو حذف) */
export type ActionType = 'add' | 'remove';

/** نوع الصلاحية */
export type PermissionType = 'job' | 'user';

/** نوع التفويض */
export type DelegationType = 'access' | 'control';

/** نوع الكيان */
export type EntityType = 'scopes' | 'resources';
