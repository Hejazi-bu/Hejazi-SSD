# دليل نظام الصلاحيات المحدّث

## ملخص التحديثات الرئيسية

تم إصلاح وتحديث نظام الصلاحيات الثلاثي بالكامل مع إضافة نظام استماع لحظي وتنبيهات ذكية.

---

## 1. توحيد منطق النطاق (Scope Unification)

### التغييرات الأساسية:
- **قبل**: النطاق يشمل `الشركة (company)` + `القطاع (sector)` + `الإدارة (department)` + `القسم (section)`
- **بعد**: النطاق يشمل **فقط** `الشركة (company)` + `القسم (section)`

### الملفات المعدلة:

#### 1. Hook الأساسي (`useAccessManager.ts`)
```typescript
// واجهة النطاق المحدثة
export interface ScopeDefinition {
    companies?: string[];    // مصفوفة معرفات الشركات
    sections?: string[];     // مصفوفة معرفات الأقسام
}

export interface ScopePayload {
    target_company_id?: string | null;
    target_job_id?: string | null;
    target_user_id?: string | null;
    // النطاق الممنوح (الشركة والقسم فقط)
    scope_company_id?: string | null;
    scope_section_id?: string | null;
    restricted_to_company?: boolean;
}
```

#### 2. مكونات الواجهة المشتركة
- **`ScopeRuleBuilder.tsx`**: إزالة اختيار القطاع والإدارة، الإبقاء على الشركة والقسم فقط
- **`ScopeList.tsx`**: عرض الشركة والقسم فقط
- **`ScopeConfigDialog.tsx`**: كان يعرض الشركة والقسم فقط بالفعل (لم يتغير)

#### 3. ملفات نظام تفويض الوصول (Access Delegation)
جميع الملفات التالية تم تحديثها:
- ✅ `AccessJobScopes.tsx`
- ✅ `AccessUserScopes.tsx`
- ✅ `AccessJobResources.tsx`
- ✅ `AccessUserResources.tsx`

التعديلات:
- إزالة `const [sectors, setSectors]` و `const [departments, setDepartments]`
- تقليص `Promise.all` من 5 عناصر إلى 3 (jobs, companies, sections فقط)
- تحديث props الممررة إلى `ScopeRuleBuilder` و `ScopeList`

#### 4. ملفات نظام تفويض التحكم (Control Delegation)
جميع الملفات التالية تم تحديثها:
- ✅ `ControlJobScopes.tsx`
- ✅ `ControlUserScopes.tsx`
- ✅ `ControlJobResources.tsx`
- ✅ `ControlUserResources.tsx`

نفس التعديلات المذكورة أعلاه.

---

## 2. نظام التنبيهات اللحظية (Real-time Notifications System)

### الملفات الجديدة:

#### 1. Context للتنبيهات (`RealtimeNotificationsContext.tsx`)

```typescript
import { useRealtimeNotifications } from './contexts/RealtimeNotificationsContext';

// في أي component:
const { addNotification } = useRealtimeNotifications();

addNotification({
    type: 'permission_added',
    title: 'تمت إضافة صلاحية',
    message: 'تم منح وظيفتك صلاحية جديدة',
    autoClose: 7000, // ms (0 = لا إغلاق تلقائي)
    action: {
        label: 'عرض',
        onClick: () => { /* ... */ }
    }
});
```

**أنواع التنبيهات المدعومة:**
- `permission_added`: إضافة صلاحية جديدة (أخضر)
- `permission_removed`: إزالة صلاحية (أحمر)
- `delegation_added`: منح تفويض جديد (أزرق)
- `delegation_removed`: إلغاء تفويض (برتقالي)
- `concurrent_edit`: تعديل متزامن من مستخدم آخر (أصفر)
- `warning`: تحذير (برتقالي)
- `info`: معلومة (أزرق)

#### 2. Hook الاستماع اللحظي (`usePermissionChangeListener.ts`)

```typescript
import { usePermissionChangeListener, useConcurrentEditListener } from './hooks/usePermissionChangeListener';

// في أي صفحة صلاحيات:
usePermissionChangeListener({
    listenToJobPermissions: true,      // مراقبة الصلاحيات المباشرة
    listenToAccessDelegation: true,    // مراقبة تفويض الوصول
    listenToControlDelegation: true,   // مراقبة تفويض التحكم
    specificJobId: null                // null = وظيفة المستخدم الحالي
});

// مراقبة التعديلات المتزامنة:
useConcurrentEditListener('job_permissions', selectedJobId, (message) => {
    console.warn('Concurrent edit:', message);
});
```

**ميزات النظام:**
- ✅ استماع لحظي لـ 3 أنظمة صلاحيات
- ✅ كشف التغييرات (إضافة/إزالة/تعديل)
- ✅ تنبيهات ذكية حسب السياق
- ✅ كشف التعديلات المتزامنة من مستخدمين آخرين
- ✅ تجاهل التغييرات المحلية (hasPendingWrites)
- ✅ تجاهل التحميل الأول

---

## 3. التكامل في المشروع

### main.tsx
```typescript
import { RealtimeNotificationsProvider } from "./components/contexts/RealtimeNotificationsContext";

<UserProvider>
    <RealtimeNotificationsProvider>
        <LoadingProvider>
            <ActionLoadingProvider>
                <RouterProvider router={router} />
            </ActionLoadingProvider>
        </LoadingProvider>
    </RealtimeNotificationsProvider>
</UserProvider>
```

### مثال الاستخدام في صفحة JobPermissions.tsx
```typescript
export default function JobPermissions() {
    // ... hooks أخرى

    // ✅ تفعيل الاستماع اللحظي
    usePermissionChangeListener({
        listenToJobPermissions: true,
        listenToAccessDelegation: true,
        listenToControlDelegation: true,
        specificJobId: null
    });

    // ✅ مراقبة التعديلات المتزامنة
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    useConcurrentEditListener('job_permissions', selectedJobId, (message) => {
        console.warn('Concurrent edit detected:', message);
    });

    // ... باقي الكود
}
```

---

## 4. الأنظمة الثلاثة وآلية العمل

### النظام الأول: الصلاحيات المباشرة (Direct Permissions)
- **المجموعات**: `job_permissions`
- **الوظيفة**: منح صلاحيات مباشرة لوظيفة على خدمات/صفحات/إجراءات
- **النطاق**: يدعم تحديد الشركة والقسم لكل صلاحية

### النظام الثاني: تفويض الوصول (Access Delegation)
- **المجموعات**: `access_job_scopes`, `access_job_resources`, `access_user_scopes`, `access_user_resources`
- **الوظيفة**: تحديد من يمكن للوظيفة/المستخدم الوصول إليهم وإلى أي موارد
- **النطاق**: الشركة والقسم فقط

### النظام الثالث: تفويض التحكم (Control Delegation)
- **المجموعات**: `control_job_scopes`, `control_job_resources`, `control_user_scopes`, `control_user_resources`
- **الوظيفة**: تحديد من يمكن للوظيفة/المستخدم التحكم بهم وبأي موارد
- **النطاق**: الشركة والقسم فقط

---

## 5. آلية الاستماع اللحظي

### مراقبة الصلاحيات المباشرة:
```javascript
const q = query(
    collection(firestore, 'job_permissions'),
    where('job_id', '==', jobId)
);

const unsubscribe = onSnapshot(q, (snapshot) => {
    // فحص التغييرات
    snapshot.docChanges().forEach(change => {
        if (change.type === 'added') { /* تنبيه: صلاحية جديدة */ }
        if (change.type === 'removed') { /* تنبيه: إزالة صلاحية */ }
        if (change.type === 'modified') { /* تنبيه: تعديل صلاحية */ }
    });
});
```

### مراقبة تفويض الوصول:
- مراقبة `access_job_scopes`: النطاقات الممنوحة
- مراقبة `access_job_resources`: الموارد الممنوحة

### مراقبة تفويض التحكم:
- مراقبة `control_job_scopes`: النطاقات للتحكم
- مراقبة `control_job_resources`: الموارد للتحكم

---

## 6. سيناريوهات الاستخدام

### السيناريو 1: مستخدم يفتح صفحة الوظائف
1. ✅ يتم تفعيل `usePermissionChangeListener`
2. ✅ يتم الاستماع لأي تغيير في صلاحيات وظيفته
3. ✅ إذا تم منحه صلاحية جديدة → تنبيه أخضر
4. ✅ إذا تم إلغاء صلاحية → تنبيه أحمر

### السيناريو 2: مستخدم يختار وظيفة ويعدلها
1. ✅ يتم تفعيل `useConcurrentEditListener` للوظيفة المختارة
2. ✅ إذا قام مستخدم آخر بتعديل نفس الوظيفة → تنبيه أصفر
3. ✅ التنبيه يحتوي على زر "إعادة التحميل"

### السيناريو 3: تغيير في نظام التفويض
1. ✅ مستخدم يفتح صفحة Access Job Scopes
2. ✅ مسؤول آخر يضيف نطاق جديد لوظيفة المستخدم
3. ✅ التنبيه يظهر فوراً: "تم توسيع نطاق الوصول"

---

## 7. الملفات الجديدة والمحدثة

### ملفات جديدة:
- ✨ `src/components/contexts/RealtimeNotificationsContext.tsx`
- ✨ `src/hooks/usePermissionChangeListener.ts`

### ملفات محدثة:
- ✅ `src/hooks/useAccessManager.ts`
- ✅ `src/components/Permission/Delegation/Shared/ScopeRuleBuilder.tsx`
- ✅ `src/components/Permission/Delegation/Shared/ScopeList.tsx`
- ✅ `src/components/Permission/Delegation/Access/*.tsx` (4 ملفات)
- ✅ `src/components/Permission/Delegation/Control/*.tsx` (4 ملفات)
- ✅ `src/components/Permission/JobPermissions.tsx`
- ✅ `src/main.tsx`

---

## 8. كيفية إضافة الاستماع اللحظي لصفحة جديدة

```typescript
import { usePermissionChangeListener } from '../../hooks/usePermissionChangeListener';

function MyNewPermissionPage() {
    // 1. إضافة الاستماع اللحظي
    usePermissionChangeListener({
        listenToJobPermissions: true,
        listenToAccessDelegation: true,
        listenToControlDelegation: true,
        specificJobId: null // أو ID محدد
    });

    // 2. (اختياري) مراقبة التعديلات المتزامنة
    const [selectedId, setSelectedId] = useState<string | null>(null);
    useConcurrentEditListener('job_permissions', selectedId, (msg) => {
        console.warn('Concurrent edit:', msg);
    });

    // ... باقي الكود
}
```

---

## 9. اختبار النظام

### اختبار التنبيهات اليدوي:
```typescript
import { useRealtimeNotifications } from './contexts/RealtimeNotificationsContext';

const { addNotification } = useRealtimeNotifications();

// اختبار تنبيه إضافة صلاحية
addNotification({
    type: 'permission_added',
    title: 'اختبار: صلاحية جديدة',
    message: 'هذا تنبيه اختباري',
    autoClose: 5000
});
```

### اختبار الاستماع اللحظي:
1. افتح صفحة صلاحيات في نافذتين مختلفتين
2. عدل صلاحية في النافذة الأولى
3. يجب أن يظهر تنبيه في النافذة الثانية فوراً

---

## 10. الأداء والتحسينات

### التحسينات المطبقة:
- ✅ استخدام `useRef` لتخزين البيانات السابقة (تجنب re-renders)
- ✅ فلترة `hasPendingWrites` (تجاهل التغييرات المحلية)
- ✅ تجاهل التحميل الأول (isFirstLoad)
- ✅ حد أقصى 5 تنبيهات في وقت واحد
- ✅ إغلاق تلقائي بعد 5-10 ثواني
- ✅ استخدام `AnimatePresence` للانتقالات السلسة

### أفضل الممارسات:
- استخدم `specificJobId` عند مراقبة وظيفة محددة
- لا تفعّل جميع الـ listeners إذا لم تكن بحاجتها
- استخدم `autoClose: 0` للتنبيهات المهمة التي يجب أن يراها المستخدم

---

## 11. الدعم والصيانة

### Cloud Functions المستخدمة:
- `manageJobPermissions`
- `manageJobAccessResourcesSecure`
- `manageJobAccessScopeSecure`
- `manageUserAccessResourcesSecure`
- `manageUserAccessScopeSecure`
- `manageControlDelegationSecure`
- `manageJobControlResourcesSecure`
- `manageJobControlScopeSecure`
- `manageUserControlResourcesSecure`
- `manageUserControlScopeSecure`

### تحديثات مطلوبة في Backend:
⚠️ **مهم**: يجب تحديث Cloud Functions لتتوافق مع الواجهات الجديدة:
- إزالة `scope_sector_id` و `scope_department_id` من المعالجة
- الإبقاء فقط على `scope_company_id` و `scope_section_id`

---

تم بحمد الله ✅
