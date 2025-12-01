# CLAUDE.md - AI Assistant Guide for Hejazi-SSD

**Last Updated**: 2025-12-01
**Project**: Hejazi-SSD - Enterprise Permission Management System
**Repository**: https://github.com/Hejazi-bu/Hejazi-SSD

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture & Patterns](#architecture--patterns)
4. [Directory Structure](#directory-structure)
5. [Key Conventions](#key-conventions)
6. [Development Workflows](#development-workflows)
7. [Testing Guidelines](#testing-guidelines)
8. [Common Tasks](#common-tasks)
9. [Important Context](#important-context)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

**Hejazi-SSD** is a sophisticated, enterprise-grade **permission management and delegation system** designed for complex organizational hierarchies. The system provides:

- **Granular Access Control**: Multi-level permissions (service → sub-service → sub-sub-service)
- **Delegation System**: Complex delegation rules with scope-based enforcement
- **User Onboarding**: Comprehensive user request processing and approval workflow
- **Bilingual Support**: Full Arabic and English internationalization
- **Real-time Updates**: Firestore-powered real-time permission synchronization
- **Task Management**: Workflow-based task assignment and tracking
- **Facility Management**: Spatial/organizational structure management
- **Guard Rating**: Company and guard evaluation system

### Core Business Logic

The application manages **three parallel permission systems**:

1. **Direct Permissions**: Job-based and user-specific permission assignments
2. **Delegation System**: Access/Control rules with hierarchical scope enforcement
3. **Onboarding System**: User request lifecycle management

---

## 🛠 Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.9.2 | Type safety |
| Vite | 7.1.2 | Build tool & dev server |
| Tailwind CSS | 3.4.17 | Utility-first styling |
| React Router | 7.6.2 | Client-side routing |
| Framer Motion | 12.23.12 | Animations |
| Material-UI | 7.3.2 | Component library |
| TanStack Table | 8.21.3 | Data tables |
| Recharts | 3.3.0 | Data visualization |
| i18next | 23.8.1 | Internationalization |
| Axios | 1.12.2 | HTTP client |

### Backend & Services
| Technology | Version | Purpose |
|------------|---------|---------|
| Firebase Auth | 12.2.1 | Authentication |
| Cloud Firestore | 12.2.1 | NoSQL database |
| Firebase Functions | 6.6.0 | Serverless backend (Node.js 22) |
| Firebase Storage | 12.2.1 | File storage |
| Firebase Admin SDK | 13.5.0 | Server-side operations |
| Google Cloud Pub/Sub | 5.2.0 | Message queue |
| SendGrid | 8.1.6 | Email service |

### Development & Testing
| Technology | Version | Purpose |
|------------|---------|---------|
| Mocha | Latest | Test framework |
| NYC (Istanbul) | Latest | Code coverage |
| ESLint | Latest | Linting |
| Firebase Functions Test | 3.1.0 | Functions testing |

### Key Dependencies
- **jsPDF** + **html2canvas**: PDF generation
- **react-signature-canvas**: Digital signatures
- **Fuse.js**: Client-side fuzzy search
- **React Select**: Advanced select components
- **React DatePicker**: Date/time selection
- **react-hot-toast** + **sonner**: Toast notifications
- **Bcrypt**: Password hashing

---

## 🏗 Architecture & Patterns

### 1. Layered Architecture

```
┌─────────────────────────────────────┐
│   Presentation Layer (React)        │
│   - Components, Pages, Layouts      │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   State Layer (Context API)         │
│   - 9 nested context providers      │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   API Layer (Firebase SDK)          │
│   - Cloud Functions (30+ endpoints) │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Data Layer (Firestore)            │
│   - Real-time listeners & caching   │
└─────────────────────────────────────┘
```

### 2. Context-Based State Management

The app uses **9 nested context providers** in this exact order:

```typescript
<LanguageProvider>              // Bilingual support (ar/en)
  <DialogProvider>              // Modal/dialog state
    <UnsavedChangesProvider>   // Form dirty tracking
      <ServicesProvider>        // Services hierarchy with caching
        <ConnectivityProvider>  // Network status
          <UserProvider>        // Auth, permissions, delegation
            <LoadingProvider>   // Page-level loading
              <ActionLoadingProvider>  // Action-specific loading
                <RouterProvider />
```

**Key Contexts**:
- **UserContext**: Current user, auth state, permissions, delegation profile
- **ServicesContext**: Service hierarchy (4 levels) with version-based caching
- **LanguageContext**: `ar` or `en` with localStorage persistence
- **DialogContext**: Global modal/dialog management
- **LoadingContext**: Page-level loading indicators
- **ActionLoadingContext**: Inline action loading overlays
- **UnsavedChangesProvider**: Navigation blocking for unsaved forms

### 3. Protected Route Pattern

```typescript
// Static permission check
<ProtectedRoute permissionKey="sss:123">
  <ComponentToProtect />
</ProtectedRoute>

// Dynamic permission from URL params
<ProtectedRoute dynamic level="ss">  // level: "s" | "ss" | "sss"
  <ComponentToProtect />
</ProtectedRoute>
```

### 4. Permission Model

**Permission Key Format**:
```
s:1     // Service ID 1
ss:12   // Sub-service ID 12
sss:456 // Sub-sub-service ID 456
```

**Authorization Flow**:
1. Check if user is super admin → Grant all access
2. Check if user is frozen → Deny all access
3. Check direct user permissions
4. Check job-based permissions
5. Check delegation access/control rules
6. Apply scope restrictions (company/sector/department/section)
7. Check user-specific exceptions

### 5. Cloud Functions Architecture (5,333 lines)

**30+ Exported Functions** grouped by domain:

**Permission Management**:
- `getUserEffectivePermissions`: Calculate all permissions (direct + job + delegation)
- `checkPermission`: Verify specific permission
- `manageUserPermissionsSecure`: CRUD user permissions
- `manageJobPermissions`: CRUD job permissions

**Delegation System**:
- `getMyDelegationProfile`: Get delegation rules & managed users
- `getMyManagedUsers`: List users under delegation
- `manageAccessDelegationSecure`: Manage view-only delegation
- `manageControlDelegationSecure`: Manage edit/control delegation

**Scope Management**:
- `manageJobAccessScopeSecure`: Configure job access scope
- `manageUserAccessScopeSecure`: Configure user access scope
- `manageJobAccessResourcesSecure`: Manage job-specific resources

**User Onboarding**:
- `requestNewUser`: Submit new user request
- `processUserOnboardingTask`: Approve/reject/modify requests
- `resubmitUserOnboarding`: Resubmit after rejection

**Auth & Password**:
- `requestPasswordReset`: Generate password reset token
- `redeemPasswordResetToken`: Validate and reset password

**Event Triggers**:
- `onUserPermissionWrite`: React to permission changes
- `onJobPermissionChange`: React to job permission updates
- `onUserJobChange`: Handle user job reassignment

**Pub/Sub**:
- Email notifications via SendGrid

### 6. Caching Strategy

**Services Hierarchy Caching** (reduces Firestore reads):
```typescript
1. Fetch current version from server (1 read)
2. Compare with localStorage cached version
3. If match: Use cached data (0 reads)
4. If different: Fetch all services (4 collection reads)
5. Store in localStorage with version number
```

**Cache Keys**:
- `app_services_data_v1`: Cached service hierarchy
- `app_services_version_v1`: Version number for cache validation

---

## 📁 Directory Structure

```
Hejazi-SSD/
├── src/                              # Frontend source code
│   ├── components/                   # React components (73+ files)
│   │   ├── contexts/                # Context providers (9 contexts)
│   │   ├── home/                    # Dashboard components
│   │   ├── Permission/              # Permission & delegation UI
│   │   ├── Users/                   # User management
│   │   ├── Tasks/                   # Task management
│   │   ├── Jobs/                    # Job distribution
│   │   ├── Facility/                # Facility/spatial management
│   │   ├── GuardsRating/            # Guard evaluation
│   │   ├── common/                  # Reusable components
│   │   └── layouts/                 # Layout wrappers
│   ├── pages/                       # Page components (5 pages)
│   ├── lib/                         # Libraries & utilities
│   │   ├── firebase.ts              # Firebase initialization
│   │   ├── animations.ts            # Framer Motion presets
│   │   ├── imageUtils.ts            # Image processing
│   │   └── clientContext.ts         # Client device/location info
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAccessManager.ts      # Access control logic
│   │   ├── useOrgStructure.ts       # Org structure operations
│   │   └── usePrompt.ts             # Navigation prompts
│   ├── types/                       # TypeScript definitions
│   ├── utils/                       # Utility functions
│   ├── App.tsx                      # Main app router
│   ├── main.tsx                     # React DOM entry point
│   └── index.css                    # Global styles + Tailwind
│
├── functions/                        # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts                 # All functions (5,333 lines)
│   ├── test/                        # Test suite (135+ tests)
│   │   ├── README.md                # Testing guide (Arabic)
│   │   ├── setup.ts                 # Test configuration
│   │   ├── checkPermission.test.ts
│   │   ├── getUserEffectivePermissions.test.ts
│   │   ├── manageUserPermissions.test.ts
│   │   └── manageJobPermissions.test.ts
│   ├── .mocharc.json                # Mocha config
│   ├── .nycrc.json                  # Coverage config
│   ├── tsconfig.json                # TS config for functions
│   ├── tsconfig.test.json           # TS config for tests
│   └── package.json                 # Functions dependencies
│
├── public/                          # Static assets
│   ├── favicon/                     # App icons
│   ├── fonts/                       # Arabic & English fonts
│   └── default/                     # Default images
│
├── Configuration Files
│   ├── vite.config.ts               # Vite bundler + SSL
│   ├── tailwind.config.js           # Tailwind customization
│   ├── tsconfig.json                # Frontend TypeScript
│   ├── firebase.json                # Firebase hosting & functions
│   ├── .firebaserc                  # Firebase project ID
│   ├── vercel.json                  # Vercel deployment config
│   ├── index.html                   # HTML entry point
│   ├── postcss.config.js            # PostCSS (Tailwind)
│   ├── cors.json                    # CORS policy
│   └── package.json                 # Frontend dependencies
│
└── Documentation
    ├── CLAUDE.md                    # This file
    ├── HOW_TO_RUN_TESTS.md         # Test running guide
    └── firestore_data.json         # Sample Firestore data
```

---

## 🔑 Key Conventions

### Naming Conventions

**Firestore Collections & Fields**: `snake_case`
```typescript
user_permissions, job_permissions, user_id, company_id
```

**Bilingual Fields**: Suffix with `_ar` or `_en`
```typescript
name_ar, name_en, first_name_ar, first_name_en
```

**React Components**: `PascalCase`
```typescript
HomePage, UserRequestsHistory, ManageFacility
```

**Context Providers**: End with `Provider`
```typescript
UserProvider, ServicesProvider, LanguageProvider
```

**TypeScript Interfaces**: `PascalCase`
```typescript
User, Permission, DelegationProfile, ScopeDefinition
```

### User Data Structure

```typescript
interface User {
  // Identity
  id: string                    // Firebase UID
  name_ar: string
  name_en: string
  first_name_ar: string
  first_name_en: string
  father_name_ar: string
  father_name_en: string
  last_name_ar: string
  last_name_en: string
  email: string
  phone_number: string
  avatar_url?: string

  // Organization
  job_id: string
  company_id: string
  sector_id?: string
  department_id?: string
  section_id?: string

  // Status Flags
  is_super_admin: boolean
  is_allowed: boolean          // Can access system
  is_frozen: boolean           // Temporarily blocked

  // Exception Flags
  app_exception: boolean       // App-wide access exception
  company_exception: boolean   // Company-wide exception
  job_exception: boolean       // Job-specific exception

  // Populated Objects (joins)
  job?: Job
  company?: Company
  sector?: Sector
  department?: Department
  section?: Section

  // Metadata
  signature_url?: string
  seal_url?: string
  permissions_updated_at?: Timestamp
  favorite_services?: string[]
  favorite_sub_services?: string[]
}
```

### Permission Data Structure

```typescript
interface Permission {
  id: string                   // Auto-generated doc ID
  permission_key: string       // "s:1", "ss:12", "sss:456"
  permission_type: 'view' | 'edit'
  granted_at: Timestamp
  granted_by: string           // User ID who granted
}
```

### Scope Definition Pattern

```typescript
interface ScopeDefinition {
  scope_company_id?: string | null
  scope_sector_id?: string | null
  scope_department_id?: string | null
  scope_section_id?: string | null
  restricted_to_company?: boolean
}
```

### Delegation Rule Structure

```typescript
interface DelegationRule {
  id: string
  rule_type: 'access' | 'control'   // View-only vs Edit
  permission_key: string             // Target permission
  scope?: ScopeDefinition            // Optional scope restriction
  granted_at: Timestamp
  granted_by: string
}
```

---

## 💻 Development Workflows

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/Hejazi-bu/Hejazi-SSD.git
cd Hejazi-SSD

# 2. Install frontend dependencies
npm install

# 3. Install functions dependencies
cd functions
npm install
cd ..

# 4. Set up environment variables
# Create .env file with Firebase config
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# etc.

# 5. Run development server
npm run dev
# Opens https://localhost:5173
```

### Development Server

```bash
# Frontend dev server (with HMR & SSL)
npm run dev

# Firebase emulators (optional for local testing)
firebase emulators:start

# Functions emulator only
firebase emulators:start --only functions

# Firestore emulator only
firebase emulators:start --only firestore
```

### Building for Production

```bash
# Build frontend
npm run build
# Output: dist/

# Build functions
cd functions
npm run build
# Output: functions/lib/

# Preview production build
npm run preview
```

### Git Workflow

**IMPORTANT**: Always develop on feature branches starting with `claude/`

```bash
# Current branch (from git status)
claude/claude-md-mimzgcm1sp0j9gb9-013t5XHF6XA63zrdgUSJyES9

# Creating commits
git add .
git commit -m "feat: Add new feature"

# Pushing changes (ALWAYS use -u origin)
git push -u origin claude/claude-md-mimzgcm1sp0j9gb9-013t5XHF6XA63zrdgUSJyES9

# If push fails due to network, retry with exponential backoff:
# Wait 2s, retry → Wait 4s, retry → Wait 8s, retry → Wait 16s, retry
```

**Git Safety Rules**:
- ✅ ALWAYS push to branches starting with `claude/`
- ❌ NEVER push to main/master without permission
- ❌ NEVER use `git push --force` unless explicitly requested
- ❌ NEVER skip hooks (`--no-verify`)
- ❌ NEVER amend commits from other developers

### Commit Message Format

```bash
# Feature
git commit -m "feat: Add user delegation management UI"

# Bug fix
git commit -m "fix: Resolve permission caching issue"

# Update/enhancement
git commit -m "update: Improve performance of service hierarchy loading"

# Refactor
git commit -m "refactor: Extract permission logic into custom hook"

# Docs
git commit -m "docs: Update CLAUDE.md with testing guidelines"

# Test
git commit -m "test: Add tests for delegation system"
```

---

## 🧪 Testing Guidelines

### Test Location & Structure

```
functions/test/
├── README.md                              # Comprehensive guide (Arabic)
├── setup.ts                               # Test configuration
├── checkPermission.test.ts               # 40+ tests
├── getUserEffectivePermissions.test.ts   # 35+ tests
├── manageUserPermissions.test.ts         # 30+ tests
└── manageJobPermissions.test.ts          # 30+ tests
```

### Running Tests

```bash
# Navigate to functions directory
cd functions

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (re-run on file change)
npm run test:watch
```

### Test Configuration Files

- **`.mocharc.json`**: Mocha test runner configuration
- **`.nycrc.json`**: Code coverage configuration (Istanbul/NYC)
- **`tsconfig.test.json`**: TypeScript config for tests

### Writing New Tests

**Test File Template**:
```typescript
import { expect } from 'chai';
import * as functions from 'firebase-functions-test';
import * as admin from 'firebase-admin';

describe('FunctionName', () => {
  let testEnv: any;

  before(() => {
    testEnv = functions();
  });

  after(() => {
    testEnv.cleanup();
  });

  it('should do something', async () => {
    // Arrange
    const input = { /* test data */ };

    // Act
    const result = await functionToTest(input);

    // Assert
    expect(result).to.have.property('success', true);
  });
});
```

### Test Coverage

Current coverage: **135+ tests** across 4 test files covering:
- Permission checking logic
- User effective permissions calculation
- User permissions management (CRUD)
- Job permissions management (CRUD)

**Target**: Maintain >80% code coverage for Cloud Functions

---

## 🚀 Common Tasks

### Task 1: Add a New Permission

**Files to modify**:
1. `functions/src/index.ts` - Add permission key to validation
2. Add permission document to Firestore collection
3. Update UI in `src/components/Permission/`

**Example**:
```typescript
// In Cloud Function
const newPermission = {
  permission_key: 'sss:789',
  permission_type: 'view',
  granted_at: admin.firestore.FieldValue.serverTimestamp(),
  granted_by: context.auth.uid
};

await admin.firestore()
  .collection('user_permissions')
  .doc(userId)
  .collection('permissions')
  .add(newPermission);
```

### Task 2: Create a New Context Provider

**Location**: `src/components/contexts/`

**Template**:
```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';

interface MyContextType {
  // Define your context shape
  value: string;
  setValue: (val: string) => void;
}

const MyContext = createContext<MyContextType | undefined>(undefined);

export const MyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value, setValue] = useState<string>('');

  useEffect(() => {
    // Initialization logic
  }, []);

  return (
    <MyContext.Provider value={{ value, setValue }}>
      {children}
    </MyContext.Provider>
  );
};

export const useMyContext = () => {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
};
```

**Don't forget**: Add to context nesting in `src/main.tsx`

### Task 3: Add a New Cloud Function

**Location**: `functions/src/index.ts`

**Template**:
```typescript
export const myNewFunction = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // 1. Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'المستخدم غير مصرح له بالوصول'
      );
    }

    // 2. Input validation
    const { param1, param2 } = data;
    if (!param1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'param1 is required'
      );
    }

    try {
      // 3. Business logic
      const result = await doSomething(param1, param2);

      // 4. Return success
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('Error in myNewFunction:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message
      );
    }
  });
```

### Task 4: Add a Protected Route

**Location**: `src/App.tsx`

**Example**:
```typescript
import ProtectedRoute from './components/common/ProtectedRoute';
import MyNewPage from './pages/MyNewPage';

// In Routes
<Route
  path="/my-new-page"
  element={
    <ProtectedRoute permissionKey="sss:123">
      <MyNewPage />
    </ProtectedRoute>
  }
/>
```

### Task 5: Add Bilingual Text

**Pattern**:
```typescript
const translations = {
  ar: {
    title: 'عنوان الصفحة',
    description: 'وصف الصفحة'
  },
  en: {
    title: 'Page Title',
    description: 'Page Description'
  }
};

// In component
const { language } = useLanguage();
const t = translations[language as 'ar' | 'en'];

return <h1>{t.title}</h1>;
```

### Task 6: Debug Permission Issues

**Steps**:
1. Check user's `is_allowed` and `is_frozen` flags
2. Check user's `is_super_admin` status
3. Query user's direct permissions:
   ```typescript
   const perms = await admin.firestore()
     .collection('user_permissions')
     .doc(userId)
     .collection('permissions')
     .get();
   ```
4. Check job permissions for user's `job_id`
5. Check delegation rules:
   ```typescript
   const delegations = await admin.firestore()
     .collection('delegation_rules')
     .where('delegator_id', '==', userId)
     .get();
   ```
6. Use `getUserEffectivePermissions` function for complete picture

### Task 7: Add a New Test

**Location**: `functions/test/`

**Steps**:
1. Create new test file: `myFeature.test.ts`
2. Import test utilities from `./setup`
3. Write describe/it blocks
4. Run `npm test` to verify

**Example**:
```typescript
import { expect } from 'chai';
import { testEnv, adminApp } from './setup';

describe('My Feature', () => {
  it('should work correctly', async () => {
    // Test implementation
    expect(true).to.be.true;
  });
});
```

---

## 🧠 Important Context

### Bilingual Support

**Language Codes**: `ar` (Arabic) | `en` (English)

**Language Context**:
```typescript
const { language, setLanguage } = useLanguage();
// language: 'ar' | 'en'
// Persisted in localStorage: 'app_language'
```

**RTL/LTR Handling**:
- Arabic: `direction: rtl` applied to `<html>`
- English: `direction: ltr` applied to `<html>`
- Automatic switching via LanguageProvider

### Authentication Flow

1. User visits app → Redirect to `/login`
2. User enters email/password → `signInWithEmailAndPassword`
3. On success → Redirect to `/`
4. HomePage checks `is_allowed` flag
5. If not allowed → Show "Access Denied" message
6. If frozen → Show "Account Frozen" message
7. If allowed → Load user data, permissions, delegation profile

### Password Reset Flow

1. User clicks "Forgot Password" → `requestPasswordReset` Cloud Function
2. Function generates token → Stores in Firestore
3. Email sent via SendGrid with link: `/__/auth/action?mode=resetPassword&oobCode={token}`
4. User clicks link → Handled by `HandleAuthAction` component
5. User enters new password → `redeemPasswordResetToken` Cloud Function
6. Password updated via Firebase Admin SDK

### Permission Inheritance

**Hierarchy** (from broad to specific):
```
Super Admin (全)
  ↓
Job Permissions (apply to all users in job)
  ↓
User Permissions (user-specific overrides)
  ↓
Delegation Access Rules (view-only delegation)
  ↓
Delegation Control Rules (edit delegation)
```

**Scope Restrictions** (from broad to narrow):
```
Company → Sector → Department → Section
```

### Real-time Updates

**User Document Listener** (in UserContext):
```typescript
useEffect(() => {
  if (!user?.id) return;

  const unsubscribe = onSnapshot(
    doc(db, 'users', user.id),
    (snapshot) => {
      // Auto-update user data on Firestore changes
      const updatedUser = snapshot.data();
      setUser(updatedUser);
    }
  );

  return () => unsubscribe();
}, [user?.id]);
```

**Firestore Triggers**: Cloud Functions react to permission changes and propagate updates

### Caching Mechanism

**Services Hierarchy**:
- Cached in `localStorage` with version key
- Reduces Firestore reads from 4 to 1 per session
- Cache invalidated when server version changes

**User Delegation Profile**:
- Cached in UserContext after first load
- Reloaded only when `permissions_updated_at` timestamp changes

---

## 🐛 Troubleshooting

### Issue: Tests Fail with "Firestore not available"

**Solution**: Start Firestore emulator
```bash
# In separate terminal
firebase emulators:start --only firestore

# Then run tests
cd functions
npm test
```

### Issue: "Permission denied" for valid user

**Checklist**:
1. ✅ User's `is_allowed` = true?
2. ✅ User's `is_frozen` = false?
3. ✅ Permission exists in user_permissions or job_permissions?
4. ✅ Scope restrictions don't block access?
5. ✅ User's `permissions_updated_at` is recent?

**Debug**:
```typescript
// In Cloud Function
const effectivePerms = await getUserEffectivePermissions({ userId });
console.log('Effective permissions:', effectivePerms);
```

### Issue: UI not updating after permission change

**Cause**: UserContext not detecting change

**Solution**: Trigger `permissions_updated_at` update
```typescript
await admin.firestore()
  .collection('users')
  .doc(userId)
  .update({
    permissions_updated_at: admin.firestore.FieldValue.serverTimestamp()
  });
```

### Issue: Vite dev server not starting

**Solution**: Check port 5173 availability
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Restart dev server
npm run dev
```

### Issue: Firebase deployment fails

**Checklist**:
1. ✅ Built functions? `cd functions && npm run build`
2. ✅ Correct Firebase project? `firebase use hejazi-ssd`
3. ✅ Logged in? `firebase login`
4. ✅ Functions dependencies installed? `cd functions && npm install`

### Issue: TypeScript errors in IDE

**Solution**: Reload TypeScript server
- VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"
- Verify `tsconfig.json` includes all source files

### Issue: Tailwind styles not applying

**Checklist**:
1. ✅ PostCSS configured? Check `postcss.config.js`
2. ✅ Tailwind imported? Check `src/index.css` has `@tailwind` directives
3. ✅ Content paths correct? Check `tailwind.config.js`

**Solution**: Restart Vite dev server
```bash
npm run dev
```

---

## 📚 Additional Resources

### Key Files to Reference

| File | Purpose |
|------|---------|
| `functions/src/index.ts` | All Cloud Functions (5,333 lines) - the backend brain |
| `src/components/contexts/UserContext.tsx` | User state, auth, permissions |
| `src/components/contexts/ServicesContext.tsx` | Services hierarchy with caching |
| `src/App.tsx` | Routing & protected routes |
| `src/lib/firebase.ts` | Firebase initialization |
| `functions/test/README.md` | Comprehensive testing guide (Arabic) |

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | User documents |
| `user_permissions/{userId}/permissions` | User-specific permissions |
| `job_permissions/{jobId}/permissions` | Job-based permissions |
| `delegation_access_rules` | View-only delegation rules |
| `delegation_control_rules` | Edit delegation rules |
| `services` | Service hierarchy level 1 |
| `sub_services` | Service hierarchy level 2 |
| `sub_sub_services` | Service hierarchy level 3 |
| `companies` | Company/organization data |
| `jobs` | Job/position definitions |
| `sectors`, `departments`, `sections` | Organizational structure |
| `user_onboarding_requests` | User request workflow |
| `pending_tasks` | Task management |

### Environment Variables

**Frontend** (`.env`):
```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=hejazi-ssd
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**Cloud Functions** (Firebase secrets):
```bash
firebase functions:secrets:set SENDGRID_KEY
```

---

## ✅ Checklist for AI Assistants

Before making changes, ensure you understand:

- [ ] Which context providers are relevant to your change
- [ ] Whether the change affects permissions (if yes, update Cloud Functions)
- [ ] Whether the change requires bilingual support
- [ ] Which Firestore collections will be read/written
- [ ] Whether the change needs tests (if yes, add to `functions/test/`)
- [ ] Whether the change affects caching (services or user delegation)
- [ ] Git workflow: commit messages, branch names, push commands

Before committing:

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Tests pass (`cd functions && npm test`)
- [ ] UI is bilingual (Arabic & English)
- [ ] No hardcoded permissions (use permission keys)
- [ ] Proper error handling with HttpsError
- [ ] Loading states implemented
- [ ] Toast notifications for user feedback

---

## 🎯 Development Philosophy

**KISS Principle**: Keep implementations simple and focused
- Don't over-engineer solutions
- Don't add features not explicitly requested
- Don't add extensive comments unless logic is complex
- Don't refactor unrelated code

**Security First**:
- Always validate inputs in Cloud Functions
- Check authentication (`context.auth`) in all callable functions
- Use HttpsError for proper error responses
- Never trust client-side validation alone

**Performance Matters**:
- Leverage caching (services, delegation profiles)
- Minimize Firestore reads (use batch operations)
- Implement optimistic UI updates where appropriate
- Use React.memo for expensive components

**User Experience**:
- Loading indicators for all async operations
- Toast notifications for success/error feedback
- Bilingual support in all user-facing text
- Accessibility considerations (ARIA labels, keyboard navigation)

---

**End of CLAUDE.md**

*This document should be updated whenever significant architectural changes are made to the codebase.*
