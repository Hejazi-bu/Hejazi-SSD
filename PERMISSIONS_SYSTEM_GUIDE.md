# 🔐 نظام الصلاحيات الموحد - دليل شامل

## 📋 نظرة عامة

تم إصلاح وتوحيد نظام الصلاحيات بالكامل في المشروع ليعتمد على **نطاق موحد** (Unified Scope) يتكون من:
- ✅ **الشركة (Company)** - إلزامي
- ✅ **القسم (Department)** - اختياري

تم إزالة: ~~القطاع (Sector)~~، ~~الفرع (Section)~~، ~~المنطقة (Region)~~، ~~الإدارة (Management)~~

---

## 🎯 الأنظمة الثلاثة

### 1️⃣ النظام الأول: الصلاحيات المباشرة (Direct Permissions)
**الوصف**: نظام الصلاحيات الأساسي للوظائف والمستخدمين

**Firestore Collections**:
- `job_permissions` - صلاحيات الوظائف
- `user_permissions` - استثناءات المستخدمين الشخصية

**مثال**:
```typescript
{
  job_id: "manager",
  permission_id: "view_reports",
  is_allowed: true,
  scope: {
    scope_company_id: "company_1",
    scope_department_id: "sales" // اختياري
  }
}
```

---

### 2️⃣ النظام الثاني: تفويض الوصول (Access Delegation)
**الوصف**: يحدد "ما" يمكن للوظيفة/المستخدم الوصول إليه و"من" يمكنهم رؤيته

**Firestore Collections**:
- `access_job_scopes` - نطاقات الوصول للوظائف (WHO)
- `access_user_scopes` - نطاقات الوصول للمستخدمين (WHO)
- `access_job_resources` - موارد الوصول للوظائف (WHAT)
- `access_user_resources` - موارد الوصول للمستخدمين (WHAT)

**مثال - Scopes (WHO)**:
```typescript
{
  target_job_id: "hr_manager",
  scope_company_id: "company_1",
  scope_department_id: "hr" // يمكنه الوصول لموظفي قسم HR فقط
}
```

**مثال - Resources (WHAT)**:
```typescript
{
  service_id: "attendance",
  sub_service_id: "reports",
  scope: {
    scope_company_id: "company_1",
    scope_department_id: "sales" // فقط تقارير الحضور لقسم المبيعات
  }
}
```

---

### 3️⃣ النظام الثالث: تفويض التحكم (Control Delegation)
**الوصف**: يحدد "من" يمكن للوظيفة/المستخدم التحكم به و"ما" يمكنهم تفويضه

**Firestore Collections**:
- `control_job_scopes` - نطاقات التحكم للوظائف (WHO)
- `control_user_scopes` - نطاقات التحكم للمستخدمين (WHO)
- `control_job_resources` - موارد التحكم للوظائف (WHAT)
- `control_user_resources` - موارد التحكم للمستخدمين (WHAT)

**الفرق بين Access و Control**:
- **Access**: يمكن "رؤية" البيانات فقط
- **Control**: يمكن "التعديل" و"التفويض" للآخرين

---

## 📁 هيكل الملفات

### Frontend (React + TypeScript)

```
src/
├── types/
│   └── permissions.types.ts        # الواجهات الموحدة
│
├── services/
│   └── permissionsNotificationService.ts  # خدمة التنبيهات المركزية
│
├── hooks/
│   ├── useAccessManager.ts         # Hook رئيسي للأنظمة الثلاثة
│   └── usePermissionNotifications.ts  # Hook للتنبيهات الفورية
│
└── components/
    └── Permission/
        ├── JobPermissions.tsx      # النظام 1: صلاحيات الوظائف
        ├── UserExceptions.tsx      # النظام 1: استثناءات المستخدمين
        │
        └── Delegation/
            ├── Access/
            │   ├── AccessJobScopes.tsx      # النظام 2: نطاقات الوصول للوظائف
            │   ├── AccessUserScopes.tsx     # النظام 2: نطاقات الوصول للمستخدمين
            │   ├── AccessJobResources.tsx   # النظام 2: موارد الوصول للوظائف
            │   └── AccessUserResources.tsx  # النظام 2: موارد الوصول للمستخدمين
            │
            ├── Control/
            │   ├── ControlJobScopes.tsx     # النظام 3: نطاقات التحكم للوظائف
            │   ├── ControlUserScopes.tsx    # النظام 3: نطاقات التحكم للمستخدمين
            │   ├── ControlJobResources.tsx  # النظام 3: موارد التحكم للوظائف
            │   └── ControlUserResources.tsx # النظام 3: موارد التحكم للمستخدمين
            │
            └── Shared/
                ├── DelegationTree.tsx       # شجرة الخدمات
                ├── ScopeRuleBuilder.tsx     # بناء قواعد النطاق
                └── ScopeList.tsx            # عرض قواعد النطاق
```

### Backend (Cloud Functions)

```
functions/src/
├── types/
│   └── permissions.types.ts        # الواجهات الموحدة للـ Functions
│
├── helpers/
│   └── notificationHelper.ts       # مساعد التنبيهات
│
└── index.ts                         # جميع الدوال السحابية
```

---

## 🔧 استخدام النظام

### 1. في المكونات (Components)

```typescript
import { useAccessManager } from '../hooks/useAccessManager';
import { DirectPermission } from '../types/permissions.types';

function MyComponent() {
  const { updateJobPermissions, isSubmitting } = useAccessManager();

  const addPermission = async () => {
    const newPermission: DirectPermission = {
      id: 'view_reports',
      is_allowed: true,
      scope: {
        company_id: 'company_1',
        department_id: 'sales' // اختياري
      }
    };

    await updateJobPermissions('manager_job', [newPermission], []);
  };

  return <button onClick={addPermission}>إضافة صلاحية</button>;
}
```

### 2. استخدام التنبيهات الفورية

```typescript
import { usePermissionNotifications } from '../hooks/usePermissionNotifications';

function NotificationsComponent() {
  const {
    notifications,
    unreadCount,
    markAsRead
  } = usePermissionNotifications({
    showDialogOnChange: true, // عرض تنبيه فوري
    impactLevelFilter: ['high', 'medium'], // فقط التنبيهات المهمة
    playSound: true // تشغيل صوت
  });

  return (
    <div>
      <h3>التنبيهات ({unreadCount})</h3>
      {notifications.map(notif => (
        <div key={notif.id} onClick={() => markAsRead(notif.id)}>
          {notif.message}
        </div>
      ))}
    </div>
  );
}
```

### 3. في Cloud Functions

```typescript
import { sendPermissionChangeNotification, getAffectedUsersByJobId } from './helpers/notificationHelper';

// عند تعديل صلاحية
const affectedUsers = await getAffectedUsersByJobId('manager_job');

await sendPermissionChangeNotification({
  changeType: 'permission_added',
  system: 'direct_permissions',
  affectedUserIds: affectedUsers,
  affectedJobId: 'manager_job',
  details: {
    permission_name: 'عرض التقارير',
    scope: {
      scope_company_id: 'company_1',
      scope_department_id: 'sales'
    }
  },
  changedByUserId: context.auth.uid
});
```

---

## 🔔 نظام التنبيهات الذكي

### ميزات نظام التنبيهات:

1. **تنبيهات فورية (Real-time)**:
   - تستخدم Firestore `onSnapshot` للاستماع للتغييرات
   - تحديث فوري دون الحاجة لتحديث الصفحة

2. **تنبيهات متعددة الأنظمة (Cross-system)**:
   - عند تغيير في النظام الأول، يصل التنبيه للمستخدمين المتأثرين
   - عند تغيير في النظام الثاني أو الثالث، نفس الشيء

3. **مستويات التأثير**:
   - `high`: تغييرات حرجة (إزالة صلاحيات، إزالة نطاقات تحكم)
   - `medium`: تغييرات متوسطة (إضافة صلاحيات، تعديل نطاقات)
   - `low`: تغييرات بسيطة (إضافة موارد وصول)

4. **رسائل ذكية**:
   - تتضمن اسم المستخدم الذي قام بالتغيير
   - تفاصيل التغيير (الصلاحية، النطاق، الخدمة)
   - توقيت التغيير

---

## 🎨 أفضل الممارسات

### ✅ DO (افعل)

1. **استخدم النطاق الموحد دائماً**:
   ```typescript
   scope: {
     company_id: 'company_1',
     department_id: 'sales'  // اختياري
   }
   ```

2. **استخدم التنبيهات في الصفحات المهمة**:
   ```typescript
   const { notifications } = usePermissionNotifications({
     systemFilter: ['direct_permissions'],
     unreadOnly: true
   });
   ```

3. **تحقق من الصلاحيات قبل العرض**:
   ```typescript
   const { canManageScope } = useUser();
   if (!canManageScope('company_1', 'sales')) return null;
   ```

### ❌ DON'T (لا تفعل)

1. **لا تستخدم الحقول القديمة**:
   ```typescript
   // ❌ خطأ
   scope: {
     scope_sector_id: '...',
     scope_section_id: '...'
   }
   ```

2. **لا تنسى إرسال تنبيهات بعد التغييرات**:
   ```typescript
   // ❌ خطأ
   await updateJobPermissions(...);
   // لم يتم إرسال تنبيه!

   // ✅ صحيح
   await updateJobPermissions(...);
   await sendPermissionChangeNotification(...);
   ```

3. **لا تستخدم `onSnapshot` مباشرة** - استخدم `usePermissionNotifications` بدلاً منه

---

## 🚀 الأداء والتكلفة

### تحسينات الأداء:

1. **Caching في Cloud Functions**:
   - يتم حفظ ملف التفويض (Delegation Profile) في `users/{userId}/private_data/delegation_cache`
   - يقلل من عدد القراءات من Firestore

2. **Batch Operations**:
   - التنبيهات تُرسل في `batch` واحد لتقليل عدد الكتابات

3. **Indexed Queries**:
   - جميع الاستعلامات مفهرسة للبحث السريع

### تقليل التكلفة:

1. **حد أقصى للتنبيهات**: 50 تنبيه لكل مستخدم
2. **Unsubscribe التلقائي**: عند مغادرة الصفحة
3. **Selective Listening**: الاستماع فقط للأنظمة المطلوبة

---

## 📊 الاختبار

### اختبار التنبيهات:

1. افتح صفحة الصلاحيات في نافذتين مختلفتين
2. قم بتعديل صلاحية في النافذة الأولى
3. يجب أن يظهر تنبيه فوري في النافذة الثانية

### اختبار النطاق:

1. أضف صلاحية مع نطاق محدد (company + department)
2. تحقق من ظهورها فقط للمستخدمين في هذا النطاق
3. تأكد من عدم ظهورها للمستخدمين خارج النطاق

---

## 🐛 استكشاف الأخطاء

### مشكلة: التنبيهات لا تظهر

**الحل**:
1. تحقق من Console للأخطاء
2. تأكد من استخدام `usePermissionNotifications` hook
3. تحقق من وجود `permission_notifications` collection في Firestore

### مشكلة: النطاق لا يعمل بشكل صحيح

**الحل**:
1. تحقق من استخدام `scope_company_id` و `scope_department_id` فقط
2. تأكد من عدم استخدام `scope_sector_id` أو `scope_section_id`
3. راجع دالة `isScopeMatch` في Cloud Functions

---

## 📝 ملاحظات مهمة

1. **التوافق العكسي**: الكود القديم سيعمل لكن مع تحذيرات `@deprecated`
2. **الهجرة**: يُنصح بتحديث الكود القديم تدريجياً للواجهات الجديدة
3. **التوثيق**: هذا الملف يحتوي على كل ما تحتاجه لفهم واستخدام النظام

---

## 🎯 الخلاصة

✅ **تم إنجازه**:
- توحيد النطاق (company + department فقط)
- نظام تنبيهات مركزي وذكي
- Real-time listeners في جميع الأنظمة الثلاثة
- تحسين الأداء والتكلفة
- توثيق شامل

✅ **الفوائد**:
- نظام موحد وبسيط
- تجربة مستخدم ممتازة مع التنبيهات الفورية
- سهولة الصيانة والتطوير
- أداء عالي وتكلفة منخفضة

---

**آخر تحديث**: 2025-12-01
**الإصدار**: 2.0.0
