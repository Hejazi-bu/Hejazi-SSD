# CLAUDE.md - AI Assistant Guide for Hejazi-SSD

> **Last Updated:** 2025-12-01
> **Version:** 1.0
> **Project:** Hejazi Security & Services Distribution System

This document provides comprehensive guidance for AI assistants working with the Hejazi-SSD codebase. It covers architecture, conventions, workflows, and best practices to ensure efficient and consistent development.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Architecture & Design Patterns](#architecture--design-patterns)
5. [Development Workflows](#development-workflows)
6. [Code Conventions](#code-conventions)
7. [State Management](#state-management)
8. [Permission System](#permission-system)
9. [Testing](#testing)
10. [Building & Deployment](#building--deployment)
11. [Common Tasks](#common-tasks)
12. [AI Assistant Guidelines](#ai-assistant-guidelines)

---

## 🎯 Project Overview

**Hejazi-SSD** is an enterprise-grade security and services distribution platform built with React, TypeScript, and Firebase. It provides:

- **Complex permission/delegation system** with granular scope-based access control
- **Multi-tenant organization management** with hierarchical structures
- **Guards rating and evaluation system** with PDF reports
- **Bilingual interface** (Arabic RTL / English LTR)
- **Real-time data synchronization** via Firestore
- **Serverless cloud functions** for backend logic
- **135+ comprehensive tests** ensuring reliability

**Project Scale:**
- 92+ TypeScript/React files
- 16 component directories
- 5,333 lines of cloud functions
- 135+ test cases
- ~45MB total size

**Repository:** https://github.com/Hejazi-bu/Hejazi-SSD

---

## 🛠️ Tech Stack

### Frontend Core
- **React 18.3.1** - UI library with hooks
- **TypeScript 5.9.2** - Strict mode enabled
- **Vite 7.1.2** - Build tool and dev server
- **React Router v7.6.2** - Client-side routing

### Styling & UI
- **TailwindCSS 3.4.17** - Utility-first CSS
- **Framer Motion 12.23.12** - Animations
- **MUI Material 7.3.2** - Material components
- **Emotion** - CSS-in-JS
- **HeadlessUI** - Accessible components
- **Heroicons & Lucide** - Icon libraries

### Backend & Database
- **Firebase 12.2.1** - Authentication, Firestore, Storage, Functions
- **Supabase 2.50.3** - PostgreSQL database client
- **Node.js 22** - Cloud Functions runtime
- **Express 5.1.0** - HTTP server

### Data & Visualization
- **TanStack Table 8.21.3** - Headless tables
- **Recharts 3.3.0** - Charts
- **Fuse.js 7.1.0** - Fuzzy search

### Document Generation
- **@react-pdf/renderer 4.3.1** - PDF generation
- **jsPDF 3.0.3** - PDF creation
- **html2canvas 1.4.1** - HTML to image

### Utilities
- **i18next** - Internationalization
- **Axios** - HTTP client
- **Bcrypt** - Password hashing
- **Nodemailer** - Email sending

### Testing
- **Mocha** - Test framework
- **NYC** - Code coverage

---

## 📁 Directory Structure

```
Hejazi-SSD/
├── src/                                    # Frontend React application
│   ├── components/                         # React components
│   │   ├── Administrative/                 # Organization management
│   │   ├── Facility/                       # Facility & spatial nodes
│   │   ├── GuardsRating/                   # Evaluation system
│   │   │   ├── NewEvaluationPage.tsx
│   │   │   ├── EvaluationDetails.tsx
│   │   │   ├── EditEvaluation.tsx
│   │   │   ├── EvaluationPDF.tsx
│   │   │   └── ...
│   │   ├── Permission/                     # Permission management
│   │   │   ├── JobPermissions.tsx
│   │   │   ├── UserExceptions.tsx
│   │   │   └── Delegation/                 # Scope-based delegation
│   │   │       ├── Access/                 # Access rules (read)
│   │   │       ├── Control/                # Control rules (write)
│   │   │       └── Shared/                 # Common utilities
│   │   ├── Users/                          # User management
│   │   │   ├── NewUser.tsx
│   │   │   ├── EditUserRequest.tsx
│   │   │   ├── UserRequestDetails.tsx
│   │   │   └── UserRequestsHistory.tsx
│   │   ├── Tasks/                          # Task management
│   │   ├── Services/                       # Service catalog
│   │   ├── home/                           # Dashboard & service cards
│   │   │   ├── HomePage.tsx
│   │   │   ├── ServiceCard.tsx
│   │   │   └── SubServicesPage.tsx
│   │   ├── common/                         # Shared components
│   │   ├── contexts/                       # Context providers
│   │   │   ├── UserContext.tsx             # Auth & user data
│   │   │   ├── LanguageContext.tsx         # i18n
│   │   │   ├── ServicesContext.tsx         # Service catalog
│   │   │   ├── DialogContext.tsx           # Modals
│   │   │   ├── LoadingContext.tsx          # Page loading
│   │   │   ├── ActionLoadingContext.tsx    # Action loading
│   │   │   ├── ConnectivityContext.tsx     # Network status
│   │   │   └── UnsavedChangesContext.tsx   # Form warnings
│   │   ├── ProtectedRoute.tsx              # Route guard
│   │   ├── AppLockedScreen.tsx             # Account lock view
│   │   └── NavigationBlocker.tsx           # Unsaved changes warning
│   ├── hooks/                              # Custom hooks
│   │   ├── useAccessManager.ts             # Permission management (14k lines)
│   │   ├── useOrgStructure.ts              # Organization helpers
│   │   └── usePrompt.ts                    # Browser prompts
│   ├── lib/                                # Libraries
│   │   ├── firebase.ts                     # Firebase config
│   │   └── animations.ts                   # Animation presets
│   ├── utils/                              # Utility functions
│   │   ├── textUtils.ts
│   │   └── imageUtils.ts
│   ├── types/                              # TypeScript types
│   ├── pages/                              # Page components
│   │   ├── LoginPage.tsx
│   │   ├── HandleAuthAction.tsx
│   │   ├── SetPasswordPage.tsx
│   │   └── SubServicePageRenderer.tsx
│   ├── layouts/                            # Layout wrappers
│   │   └── AdminSectionLayout.tsx
│   ├── App.tsx                             # Main router
│   ├── main.tsx                            # React entry point
│   └── index.css                           # Global styles
│
├── functions/                              # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts                        # Cloud functions (5,333 lines)
│   ├── test/                               # Test suite
│   │   ├── setup.ts                        # Test configuration
│   │   ├── checkPermission.test.ts         # 40+ tests
│   │   ├── getUserEffectivePermissions.test.ts  # 35+ tests
│   │   ├── manageUserPermissions.test.ts   # 30+ tests
│   │   ├── manageJobPermissions.test.ts    # 30+ tests
│   │   └── README.md                       # Test documentation (Arabic)
│   ├── .mocharc.json                       # Mocha config
│   ├── .nycrc.json                         # Coverage config
│   ├── tsconfig.json                       # TypeScript config
│   └── package.json                        # Node 22 dependencies
│
├── public/                                 # Static assets
│   ├── assets/                             # Images
│   ├── fonts/                              # Noto Kufi Arabic, Inter
│   ├── favicon/                            # App icons
│   └── default/                            # Default resources
│
├── Configuration Files
│   ├── vite.config.ts                      # Vite build config
│   ├── tsconfig.json                       # TypeScript compiler
│   ├── tailwind.config.js                  # TailwindCSS theme
│   ├── postcss.config.js                   # PostCSS plugins
│   ├── firebase.json                       # Firebase project
│   ├── .firebaserc                         # Project ID: hejazi-ssd
│   ├── vercel.json                         # Vercel deployment
│   ├── .env                                # Firebase credentials
│   └── package.json                        # Dependencies
│
└── Documentation
    ├── CLAUDE.md                           # This file
    └── HOW_TO_RUN_TESTS.md                 # Testing guide (Arabic)
```

---

## 🏗️ Architecture & Design Patterns

### Application Entry Point

**main.tsx** → Context Providers → RouterProvider → **App.tsx**

### Context Provider Hierarchy (Nested)

```
LanguageProvider (i18n: ar/en)
  ↓
DialogProvider (Modal management)
  ↓
UnsavedChangesProvider (Form warnings)
  ↓
ServicesProvider (Service catalog)
  ↓
ConnectivityProvider (Online/offline)
  ↓
UserProvider (Authentication & permissions)
  ↓
LoadingProvider (Page-level loading)
  ↓
ActionLoadingProvider (Action-level loading)
    ↓
  RouterProvider (React Router v7)
```

### Routing Architecture (App.tsx)

**Public Routes:**
- `/login` - Authentication page
- `/__/auth/action` - Firebase auth action handler
- `/set-password` - Password reset page

**Protected Routes** (require authentication):
- `/dashboard` - Home page
- `/:groupPage/:servicePage` - Dynamic service pages
- `/:groupPage/:servicePage/:subServicePage` - Dynamic sub-service pages
- `/companies/evaluation/details/:evaluationSequenceNumber` - View evaluation
- `/companies/evaluation/edit/:evaluationSequenceNumber` - Edit evaluation (requires `sss:3`)
- `/system/users/details/:requestId` - User details
- `/system/users/edit/:requestId` - Edit user (requires `sss:13`)

**Error Handling:**
- `AppLockedScreen` - User account locked/frozen
- `NavigationBlocker` - Warns about unsaved changes
- `LoadingScreen` - Full-page loading state
- `ActionLoadingOverlay` - Action-in-progress overlay

### Design Patterns

1. **Context API for State Management**
   - Global state via React Context
   - Custom hooks for accessing contexts (`useAuth()`, `useLanguage()`, etc.)
   - Provider hierarchy for dependency injection

2. **Protected Route Pattern**
   ```tsx
   <Route path="/path" element={
     <ProtectedRoute permissionKey="sss:3">
       <Component />
     </ProtectedRoute>
   } />
   ```

3. **Real-time Data Sync**
   - Firestore `onSnapshot()` listeners
   - React Firebase Hooks for live collections
   - Automatic UI updates on data changes

4. **Permission-Based Rendering**
   ```tsx
   const { hasPermission } = useAuth();
   if (!hasPermission('sss:3')) return <PermissionOverlay />;
   ```

5. **Bilingual Support**
   - Dual fields: `label_ar`, `label_en`
   - Language context toggle: `ar` ↔ `en`
   - RTL/LTR layout switching

6. **Loading States**
   - Page-level: `usePageLoading()`
   - Action-level: `useActionLoading()`
   - Component-level: local `isLoading` state

7. **Error Boundaries**
   - Firebase error handling
   - Network connectivity detection
   - User-friendly error messages

---

## 🔄 Development Workflows

### Local Development

```bash
# Install dependencies
npm install

# Start dev server (Vite)
npm run dev
# → Opens http://localhost:5173

# Build for production
npm run build
# → Output: dist/

# Preview production build
npm run preview
```

### Cloud Functions Development

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Run tests
npm test
# → Runs 135+ tests

# Run tests with coverage
npm run test:coverage

# Watch mode (auto-rerun on changes)
npm run test:watch

# Build TypeScript
npm run build

# Serve locally (Firebase emulator)
npm run serve

# Deploy to Firebase
npm run deploy
```

### Git Workflow

**Current Branch:** `claude/claude-md-min1aapjc31sq8tu-011ArjibrLV3AGA7QfqfbA5e`

```bash
# Check status
git status

# Stage changes
git add <files>

# Commit with descriptive message
git commit -m "وصف قصير للتعديل الذي قمت به"

# Push to remote
git push -u origin <branch-name>
# Note: Branch must start with 'claude/' and end with session ID
```

### Firebase Emulator

```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# Run tests against emulator
cd functions && npm test
```

---

## 📝 Code Conventions

### File Naming

- **Components:** PascalCase (`HomePage.tsx`, `ServiceCard.tsx`)
- **Hooks:** camelCase with `use` prefix (`useAuth.ts`, `useAccessManager.ts`)
- **Utilities:** camelCase (`textUtils.ts`, `imageUtils.ts`)
- **Types:** PascalCase (`User.ts`, `Service.ts`)
- **Contexts:** PascalCase with `Context` suffix (`UserContext.tsx`)

### Component Structure

```tsx
// 1. Imports (React, libraries, components, hooks, types)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/UserContext';
import { Button } from './common/Button';
import { User } from '../types';

// 2. Component definition
function ComponentName() {
  // 3. Hooks (in order: context, state, effects)
  const auth = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<User[]>([]);

  // 4. Event handlers
  const handleClick = () => {
    // Implementation
  };

  // 5. Render logic
  return (
    <div>
      {/* JSX */}
    </div>
  );
}

// 6. Export
export default ComponentName;
```

### TypeScript Conventions

**Strict Mode Enabled:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Type Definitions:**
```typescript
// Use interfaces for object shapes
interface User {
  id: string;
  first_name_ar: string;
  first_name_en: string;
  email: string;
  is_allowed: boolean;
}

// Use type aliases for unions/intersections
type PermissionLevel = 's' | 'ss' | 'sss';
type UserWithPermissions = User & { permissions: string[] };

// Use DocumentData for Firestore documents
import { DocumentData } from 'firebase/firestore';

const userDoc: DocumentData = {
  // ...
};
```

### Naming Conventions

**Variables:**
```typescript
// camelCase for variables and functions
const userName = 'John';
const getUserData = () => { /* ... */ };

// PascalCase for components and types
const UserProfile = () => { /* ... */ };
type UserData = { /* ... */ };

// UPPER_CASE for constants
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';
```

**Bilingual Fields:**
```typescript
// Arabic fields end with _ar
const label_ar = 'مستخدم';
const name_ar = 'أحمد';

// English fields end with _en
const label_en = 'User';
const name_en = 'Ahmed';
```

### Comment Conventions

**Arabic Comments:**
```typescript
// استخدام التعليقات بالعربية لشرح الكود
// يتم استخدام الرموز التعبيرية لتوضيح أهمية التعليق

// ✨ ميزة جديدة
// ✅ تم التحقق والاختبار
// 🔥 تغيير مهم جداً
// 👈 انتبه لهذا الجزء
// ⚠️ تحذير
// 🆕 إضافة جديدة
```

**Code Documentation:**
```typescript
/**
 * يقوم بفحص صلاحية المستخدم لخدمة معينة
 * @param userId - معرف المستخدم
 * @param serviceId - معرف الخدمة
 * @returns true إذا كان المستخدم لديه صلاحية
 */
function checkPermission(userId: string, serviceId: string): boolean {
  // Implementation
}
```

### Import Organization

```typescript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. Third-party libraries
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// 3. Contexts
import { useAuth } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';

// 4. Components
import Button from './common/Button';
import DataTable from './DataTable';

// 5. Hooks
import { useAccessManager } from '../hooks/useAccessManager';

// 6. Utils and types
import { formatDate } from '../utils/textUtils';
import { User, Service } from '../types';
```

### Firestore Patterns

**Document References:**
```typescript
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Get document
const userRef = doc(db, 'users', userId);
const userSnap = await getDoc(userRef);
const userData = userSnap.data();

// Set document
await setDoc(userRef, {
  name: 'Ahmed',
  email: 'ahmed@example.com',
  created_at: serverTimestamp()
});

// Update document
await updateDoc(userRef, {
  name: 'New Name'
});

// Delete document
await deleteDoc(userRef);
```

**Collection Queries:**
```typescript
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const usersRef = collection(db, 'users');
const q = query(
  usersRef,
  where('is_allowed', '==', true),
  orderBy('created_at', 'desc'),
  limit(10)
);
const querySnapshot = await getDocs(q);
querySnapshot.forEach((doc) => {
  console.log(doc.id, doc.data());
});
```

**Real-time Listeners:**
```typescript
import { onSnapshot } from 'firebase/firestore';

useEffect(() => {
  const unsubscribe = onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      setUserData(doc.data());
    }
  });

  return () => unsubscribe();
}, [userId]);
```

---

## 🗂️ State Management

### Available Contexts

| Context | Hook | Purpose | Key Methods |
|---------|------|---------|-------------|
| **UserContext** | `useAuth()` | Authentication & user data | `signIn()`, `signOut()`, `hasPermission()`, `user`, `lockState` |
| **LanguageContext** | `useLanguage()` | i18n language switching | `currentLanguage`, `toggleLanguage()`, `t()` |
| **ServicesContext** | `useServices()` | Service catalog loading | `services`, `isLoading` |
| **DialogContext** | `useDialog()` | Modal/dialog management | `showDialog()`, `hideDialog()` |
| **LoadingContext** | `usePageLoading()` | Page-level loading state | `isPageLoading`, `setPageLoading()` |
| **ActionLoadingContext** | `useActionLoading()` | Action-level loading | `isActionLoading`, `startAction()`, `endAction()` |
| **ConnectivityContext** | `useConnectivity()` | Network connectivity | `isOnline`, `isOffline` |
| **UnsavedChangesContext** | `useUnsavedChanges()` | Form state warnings | `hasUnsavedChanges`, `setHasUnsavedChanges()` |

### Context Usage Examples

**Authentication:**
```typescript
import { useAuth } from './components/contexts/UserContext';

function MyComponent() {
  const auth = useAuth();

  // Check if user is authenticated
  if (!auth.user) {
    return <LoginPrompt />;
  }

  // Check permission
  const canEdit = auth.hasPermission('sss:3');

  // Check if user is locked
  if (auth.lockState !== 'NONE') {
    return <AppLockedScreen reason={auth.lockState} />;
  }

  return <div>Welcome, {auth.user.first_name_ar}!</div>;
}
```

**Language Switching:**
```typescript
import { useLanguage } from './components/contexts/LanguageContext';

function LanguageToggle() {
  const { currentLanguage, toggleLanguage, t } = useLanguage();

  return (
    <button onClick={toggleLanguage}>
      {currentLanguage === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}
```

**Loading States:**
```typescript
import { useActionLoading } from './components/contexts/ActionLoadingContext';

function SaveButton() {
  const { startAction, endAction } = useActionLoading();

  const handleSave = async () => {
    startAction('حفظ البيانات...');
    try {
      await saveData();
    } finally {
      endAction();
    }
  };

  return <button onClick={handleSave}>حفظ</button>;
}
```

---

## 🔐 Permission System

### Permission Structure

**Three Levels:**
1. **Service (s:)** - Top-level service
2. **Sub-Service (ss:)** - Second-level service
3. **Sub-Sub-Service (sss:)** - Third-level service

**Permission Keys:**
```typescript
's:1'    // Service #1
'ss:5'   // Sub-Service #5
'sss:13' // Sub-Sub-Service #13 (e.g., Edit User)
```

### Scope-Based Permissions

**Scope Levels:**
- **Company Scope** - Access limited to specific companies
- **Department Scope** - Access limited to specific departments
- **Section Scope** - Access limited to specific sections

**Delegation Types:**
1. **Job Scopes** - Permissions by job title
2. **User Scopes** - Permissions by individual user
3. **Job Resources** - Resource access by job
4. **User Resources** - Resource access by user

**Access vs Control:**
- **Access** - Read-only permissions
- **Control** - Read/write permissions

### Permission Checking

**In Components:**
```typescript
import { useAuth } from '../contexts/UserContext';

function EditButton() {
  const { hasPermission } = useAuth();

  if (!hasPermission('sss:3')) {
    return null; // Hide button if no permission
  }

  return <button>تعديل</button>;
}
```

**In Routes:**
```tsx
<Route
  path="/edit/:id"
  element={
    <ProtectedRoute permissionKey="sss:3">
      <EditPage />
    </ProtectedRoute>
  }
/>
```

**In Cloud Functions:**
```typescript
// functions/src/index.ts
exports.checkPermission = onCall(async (request) => {
  const { userId, serviceId, scopeLevel } = request.data;

  // Check permission logic
  const hasAccess = await checkUserPermission(userId, serviceId, scopeLevel);

  return { hasAccess };
});
```

### Permission Caching

The system caches user permissions in the `user_delegation_profile` collection for performance:

```typescript
{
  user_id: 'user123',
  effective_permissions: {
    's:1': true,
    'ss:5': true,
    'sss:13': false
  },
  scopes: {
    company_ids: ['comp1', 'comp2'],
    department_ids: ['dept1'],
    section_ids: []
  },
  cached_at: Timestamp
}
```

---

## 🧪 Testing

### Test Suite Overview

**Location:** `functions/test/`
**Framework:** Mocha + NYC
**Total Tests:** 135+
**Node Version:** 22

### Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `checkPermission.test.ts` | 40+ | Permission validation |
| `getUserEffectivePermissions.test.ts` | 35+ | Permission retrieval |
| `manageUserPermissions.test.ts` | 30+ | User permission CRUD |
| `manageJobPermissions.test.ts` | 30+ | Job permission CRUD |

### Running Tests

```bash
# Basic test run
cd functions
npm test

# With coverage report
npm run test:coverage

# Watch mode (auto-rerun)
npm run test:watch
```

### Test Configuration

**Mocha Config** (`.mocharc.json`):
```json
{
  "require": ["ts-node/register", "test/setup.ts"],
  "extensions": ["ts"],
  "spec": "test/**/*.test.ts",
  "timeout": 10000
}
```

**Coverage Config** (`.nycrc.json`):
```json
{
  "all": true,
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"],
  "reporter": ["text", "lcov", "html"]
}
```

### Writing Tests

**Test Structure:**
```typescript
import { expect } from 'chai';
import { checkPermission } from '../src/index';

describe('checkPermission', () => {
  it('should return true for valid permission', async () => {
    const result = await checkPermission({
      userId: 'user123',
      serviceId: 'sss:3'
    });

    expect(result.hasAccess).to.be.true;
  });

  it('should return false for invalid permission', async () => {
    const result = await checkPermission({
      userId: 'user456',
      serviceId: 'sss:99'
    });

    expect(result.hasAccess).to.be.false;
  });
});
```

### Firebase Emulator for Tests

```bash
# Terminal 1: Start emulator
firebase emulators:start --only firestore

# Terminal 2: Run tests
cd functions
npm test
```

---

## 🚀 Building & Deployment

### Production Build

```bash
# Build frontend
npm run build
# → Output: dist/

# Preview build
npm run preview
# → Opens http://localhost:4173
```

### Firebase Deployment

**Project ID:** `hejazi-ssd`

```bash
# Deploy everything
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:checkPermission
```

### Vercel Deployment

**Configuration** (`vercel.json`):
```json
{
  "rewrites": [
    { "source": "/__/auth/(.*)", "destination": "/index.html" },
    { "source": "/set-password", "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Environment Variables

**Required** (`.env`):
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=hejazi-ssd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hejazi-ssd
VITE_FIREBASE_STORAGE_BUCKET=hejazi-ssd.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Note:** All frontend env vars must have `VITE_` prefix to be exposed to the client.

---

## 🔧 Common Tasks

### Adding a New Component

```bash
# Create component file
touch src/components/MyComponent.tsx
```

```tsx
// src/components/MyComponent.tsx
import React from 'react';

interface MyComponentProps {
  title: string;
}

function MyComponent({ title }: MyComponentProps) {
  return (
    <div className="p-4">
      <h1>{title}</h1>
    </div>
  );
}

export default MyComponent;
```

### Adding a New Route

```tsx
// src/App.tsx
import MyComponent from './components/MyComponent';

// Inside Routes:
<Route
  path="/my-route"
  element={
    <ProtectedRoute permissionKey="sss:15">
      <MyComponent title="عنوان الصفحة" />
    </ProtectedRoute>
  }
/>
```

### Adding a New Context

```tsx
// src/components/contexts/MyContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MyContextType {
  value: string;
  setValue: (v: string) => void;
}

const MyContext = createContext<MyContextType | undefined>(undefined);

export function MyProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState('');

  return (
    <MyContext.Provider value={{ value, setValue }}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
}
```

### Adding a Cloud Function

```typescript
// functions/src/index.ts
import { onCall } from 'firebase-functions/v2/https';

export const myNewFunction = onCall(async (request) => {
  const { data } = request;

  // Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Business logic
  const result = await processData(data);

  return { success: true, result };
});
```

### Creating a New Test

```typescript
// functions/test/myFunction.test.ts
import { expect } from 'chai';
import { myNewFunction } from '../src/index';

describe('myNewFunction', () => {
  it('should process data correctly', async () => {
    const result = await myNewFunction({
      data: { input: 'test' },
      auth: { uid: 'user123' }
    });

    expect(result.success).to.be.true;
  });
});
```

### Generating PDFs

```tsx
// Example: Evaluation PDF
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const MyPDF = () => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text>محتوى الصفحة</Text>
      </View>
    </Page>
  </Document>
);

const styles = StyleSheet.create({
  page: { padding: 30 },
  section: { margin: 10 }
});

// Generate and download
const blob = await pdf(<MyPDF />).toBlob();
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'document.pdf';
link.click();
```

---

## 🤖 AI Assistant Guidelines

### DO ✅

1. **Read Before Modifying**
   - Always read files before editing them
   - Understand existing patterns and conventions
   - Check related files for context

2. **Follow Existing Patterns**
   - Match the coding style of surrounding code
   - Use existing component structures
   - Follow naming conventions

3. **Type Safety**
   - Always define TypeScript types/interfaces
   - Use strict type checking
   - Avoid `any` type

4. **Bilingual Support**
   - Include both `_ar` and `_en` fields for labels/names
   - Support RTL for Arabic text
   - Use i18n for UI text

5. **Permission Checks**
   - Always implement permission checks for sensitive operations
   - Use `ProtectedRoute` for protected pages
   - Check permissions in components with `hasPermission()`

6. **Error Handling**
   - Wrap async operations in try-catch
   - Provide user-friendly error messages
   - Log errors for debugging

7. **Loading States**
   - Show loading indicators during async operations
   - Use `useActionLoading()` for actions
   - Use `usePageLoading()` for page-level loading

8. **Testing**
   - Write tests for new cloud functions
   - Run existing tests before committing
   - Ensure tests pass after changes

9. **Documentation**
   - Add comments in Arabic for complex logic
   - Update CLAUDE.md if adding major features
   - Document new patterns or conventions

10. **Git Commits**
    - Write clear commit messages (in Arabic)
    - Stage only relevant files
    - Push to correct branch (`claude/claude-md-*`)

### DON'T ❌

1. **Don't Break TypeScript**
   - Don't disable strict mode
   - Don't use `@ts-ignore` without justification
   - Don't ignore type errors

2. **Don't Skip Authentication**
   - Never expose unprotected routes
   - Don't bypass permission checks
   - Don't store sensitive data in local storage

3. **Don't Hardcode**
   - Don't hardcode API URLs
   - Don't hardcode credentials
   - Use environment variables

4. **Don't Ignore Errors**
   - Don't use empty catch blocks
   - Don't silently fail
   - Always handle promise rejections

5. **Don't Modify Without Understanding**
   - Don't change code you haven't read
   - Don't refactor without understanding the full context
   - Don't remove code without verifying it's unused

6. **Don't Break Existing Features**
   - Don't change shared components without checking usage
   - Don't modify context providers without testing
   - Run tests before committing

7. **Don't Create Unnecessary Files**
   - Don't create duplicate components
   - Don't create new files if existing ones can be extended
   - Don't create README files unless necessary

8. **Don't Ignore Performance**
   - Don't create infinite loops
   - Don't forget to unsubscribe from listeners
   - Don't load unnecessary data

9. **Don't Break Bilingual Support**
   - Don't add only Arabic or only English labels
   - Don't hardcode language-specific text
   - Use i18n system

10. **Don't Skip the Build**
    - Don't commit without testing locally
    - Don't push without running `npm run build`
    - Don't deploy without testing

### Best Practices

**When Adding Features:**
1. Read related existing code
2. Check if similar features exist
3. Follow existing patterns exactly
4. Add TypeScript types
5. Include bilingual support
6. Add permission checks if needed
7. Implement loading states
8. Add error handling
9. Write tests (for cloud functions)
10. Test thoroughly before committing

**When Fixing Bugs:**
1. Reproduce the bug first
2. Identify root cause
3. Fix the issue (not symptoms)
4. Add tests to prevent regression
5. Verify fix doesn't break other features
6. Run full test suite

**When Refactoring:**
1. Understand the code thoroughly
2. Make small, incremental changes
3. Test after each change
4. Maintain existing behavior
5. Update tests if needed
6. Document significant changes

---

## 📞 Key Files Reference

### Most Important Files

| File | Lines | Purpose |
|------|-------|---------|
| `functions/src/index.ts` | 5,333 | All cloud functions |
| `src/hooks/useAccessManager.ts` | 14,058 | Permission management |
| `src/App.tsx` | 93 | Main routing |
| `src/main.tsx` | - | Entry point |
| `src/components/contexts/UserContext.tsx` | - | Authentication |

### Configuration Files

- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.js` - TailwindCSS theme
- `firebase.json` - Firebase project config
- `.env` - Environment variables

### Documentation Files

- `CLAUDE.md` - This file
- `HOW_TO_RUN_TESTS.md` - Testing guide (Arabic)
- `functions/test/README.md` - Test documentation (Arabic)

---

## 🎓 Learning Resources

### Understanding the Codebase

1. **Start Here:**
   - Read `src/App.tsx` - Understand routing
   - Read `src/main.tsx` - Understand context hierarchy
   - Read `src/components/contexts/UserContext.tsx` - Understand auth

2. **Explore Components:**
   - `src/components/home/HomePage.tsx` - Dashboard
   - `src/components/Users/NewUser.tsx` - User management
   - `src/components/Permission/JobPermissions.tsx` - Permissions

3. **Study Cloud Functions:**
   - `functions/src/index.ts` - Backend logic
   - `functions/test/checkPermission.test.ts` - Testing patterns

### Tech Stack Docs

- [React 18](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Vite](https://vite.dev/)
- [TailwindCSS](https://tailwindcss.com/docs)
- [Firebase](https://firebase.google.com/docs)
- [React Router v7](https://reactrouter.com/)
- [Framer Motion](https://www.framer.com/motion/)

---

## 📄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-01 | Initial comprehensive documentation |

---

## 📝 Notes

- This project uses **Arabic** as the primary language for comments and documentation
- **RTL layout** is the default (Arabic)
- All dates use Firestore `Timestamp` objects
- Server timestamps are used for created_at/updated_at fields
- Permission system is complex - study it thoroughly before making changes
- Tests are critical - always run them before committing

---

**For questions or clarifications, review the code or ask the development team.**

**Happy coding! 🚀**
