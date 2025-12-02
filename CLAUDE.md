# CLAUDE.md - AI Assistant Guide for Hejazi-SSD

## Project Overview

**Hejazi-SSD** is a comprehensive security services management system built with modern web technologies. The application provides a platform for managing security operations, guard evaluations, task assignments, user management, and administrative functions.

### Technology Stack

- **Frontend Framework**: React 18.3.1
- **Build Tool**: Vite 7.1.2
- **Language**: TypeScript 5.9.2
- **Styling**: Tailwind CSS 3.4.17
- **Backend**: Firebase (Firestore, Auth, Functions, Storage)
- **Routing**: React Router DOM 7.6.2
- **State Management**: React Context API
- **UI Libraries**:
  - Material-UI (@mui/material)
  - Headless UI
  - Heroicons
  - Lucide React
- **Charts**: Recharts, Chart.js, React-Chartjs-2
- **PDF Generation**: jsPDF, @react-pdf/renderer
- **Internationalization**: i18next, react-i18next
- **Animations**: Framer Motion
- **Date Handling**: React DatePicker
- **Notifications**: Sonner, React Hot Toast

## Directory Structure

```
/home/user/Hejazi-SSD/
├── src/
│   ├── components/          # React components
│   │   ├── contexts/       # Context providers (state management)
│   │   ├── layouts/        # Layout components
│   │   ├── home/          # Home page components
│   │   ├── Jobs/          # Job distribution components
│   │   ├── Tasks/         # Task management components
│   │   ├── GuardsRating/  # Guard evaluation components
│   │   ├── Services/      # Service management components
│   │   ├── Users/         # User management components
│   │   ├── Administrative/ # Administrative components
│   │   ├── Permission/    # Permission management components
│   │   ├── Facility/      # Facility management components
│   │   ├── dashboard/     # Dashboard components
│   │   ├── common/        # Reusable common components
│   │   └── AhmedSaeed/    # Specific user/module components
│   ├── pages/             # Page-level components
│   │   └── admin/         # Admin-specific pages
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Library utilities and configurations
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   ├── layouts/           # Layout templates
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles
├── functions/             # Firebase Cloud Functions
├── public/               # Static assets
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── firebase.json         # Firebase configuration
└── .env                  # Environment variables

```

## Key Components and Architecture

### Context Providers (State Management)

The application uses React Context API for state management. Context providers are nested in a specific hierarchy in `src/main.tsx`:

```
LanguageProvider
  └─ DialogProvider
      └─ UnsavedChangesProvider
          └─ ServicesProvider
              └─ ConnectivityProvider
                  └─ UserProvider
                      └─ LoadingProvider
                          └─ ActionLoadingProvider
                              └─ RouterProvider
```

**Key Contexts:**
- `UserContext.tsx` - Authentication and user state management
- `LanguageContext.tsx` - Multi-language support (i18n)
- `ServicesContext.tsx` - Services and permissions management
- `DialogContext.tsx` - Global dialog/modal management
- `LoadingContext.tsx` - Page-level loading states
- `ActionLoadingContext.tsx` - Action-specific loading overlays
- `UnsavedChangesContext.tsx` - Unsaved changes tracking and navigation blocking
- `ConnectivityContext.tsx` - Network connectivity monitoring
- `PermissionStatusContext.tsx` - Permission status management

### Routing Structure

The application uses React Router with a dynamic routing system based on services and permissions:

**Route Patterns:**
- `/login` - Login page (redirects to dashboard if authenticated)
- `/dashboard` - Main dashboard/home page
- `/:groupPage/:servicePage` - Service pages
- `/:groupPage/:servicePage/:subServicePage` - Sub-service pages (dynamic)
- `/companies/evaluation/details/:evaluationSequenceNumber` - Guard evaluation details
- `/companies/evaluation/edit/:evaluationSequenceNumber` - Edit guard evaluation
- `/system/users/details/:requestId` - User request details
- `/system/users/edit/:requestId` - Edit user request
- `/__/auth/action` - Firebase auth action handler
- `/set-password` - Password setting page

**Route Protection:**
- `ProtectedRoute` component wraps routes requiring authentication
- Dynamic permission checking based on `permissionKey` prop
- Lock state checking (ACCOUNT_DISABLED, PASSWORD_RESET_REQUIRED)

### Custom Hooks

Located in `src/hooks/`:
- `useAccessManager.ts` - Access control and permission management
- `useOrgStructure.ts` - Organization structure data management
- `usePrompt.ts` - Navigation prompting for unsaved changes

### Firebase Integration

Firebase configuration in `src/lib/firebase.ts`:
- **Authentication**: User login, session management
- **Firestore**: Database for all application data
- **Functions**: Server-side logic (Cloud Functions)
- **Storage**: File and image storage

**Environment Variables** (in `.env`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Development Workflow

### Running the Development Server

```bash
npm run dev
```

This starts the Vite development server with:
- Hot module replacement (HMR)
- HTTPS support via `@vitejs/plugin-basic-ssl`
- Fast refresh for React components

### Building for Production

```bash
npm run build
```

This command:
1. Cleans the `dist` directory using `rimraf`
2. Runs Vite build process
3. Outputs optimized production files to `dist/`

### Preview Production Build

```bash
npm run preview
```

### Firebase Deployment

The project is configured for Firebase Hosting:
- **Hosting Directory**: `dist/` (built files)
- **Rewrites**: All routes redirect to `index.html` for SPA routing
- **Functions**: Located in `functions/` directory

## TypeScript Configuration

### Main `tsconfig.json` Settings:
- **Target**: ESNext
- **Module**: ESNext
- **JSX**: react-jsx
- **Strict Mode**: Enabled
- **Module Resolution**: Node
- **Allows**: JS/JSX files, synthetic default imports
- **Includes**: `src/`, `**/*.jsx`

## Styling Conventions

### Tailwind CSS
- Utility-first CSS framework
- Configuration in `tailwind.config.js`
- Global styles in `src/index.css`
- PostCSS configuration for processing

### Arabic/RTL Support
The application supports right-to-left (RTL) languages, particularly Arabic. Comments in the codebase often use Arabic for developer notes.

## Code Conventions and Best Practices

### Component Organization
1. **Feature-based Structure**: Components are organized by feature/domain (Users, Tasks, GuardsRating, etc.)
2. **Separation of Concerns**: Layouts, pages, and reusable components are separated
3. **Context Co-location**: Context providers are in `components/contexts/`

### Naming Conventions
- **Components**: PascalCase (e.g., `UserProfileOverlay.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAccessManager.ts`)
- **Contexts**: PascalCase with `Context` suffix (e.g., `UserContext.tsx`)
- **Utilities**: camelCase (e.g., `textUtils.ts`)

### File Extensions
- **TypeScript Components**: `.tsx`
- **TypeScript Utilities**: `.ts`
- **Type Definitions**: `.ts` in `src/types/`

### Import Patterns
- Absolute imports from `src/`
- Named exports preferred over default exports (except for pages)
- Environment variables accessed via `import.meta.env.VITE_*`

## Key Features and Modules

### 1. Authentication & Authorization
- Firebase Authentication
- Role-based access control
- Permission-based routing
- Account lock states (disabled, password reset required)

### 2. Guards Rating/Evaluation
- Create and manage guard evaluations
- View evaluation history
- Generate PDF reports
- Edit evaluations with permission checks

### 3. Task Management
- Task assignment and tracking
- Task history
- Pending tasks view
- Task overlays for quick access

### 4. User Management
- User request creation
- User profile management
- Edit user requests with proper permissions
- User request details view

### 5. Service Management
- Dynamic service and sub-service structure
- Service-based navigation
- Permission-controlled service access

### 6. Job Distribution
- Job assignment management
- Distribution tracking

### 7. Dashboard
- Overview cards
- Quick access to services
- Statistics and charts

## Working with the Codebase

### Adding New Features

1. **Identify the Module**: Determine which feature area (Users, Tasks, etc.)
2. **Create Component**: Add component in appropriate `components/` subdirectory
3. **Add Route**: Update `App.tsx` with new route and permission checks
4. **Context Integration**: Use existing contexts or create new ones if needed
5. **Type Definitions**: Add types to `src/types/` if needed
6. **Permission Check**: Ensure proper `permissionKey` is set for protected routes

### Modifying Existing Components

1. **Read the Component First**: Always read the entire component before making changes
2. **Check Context Dependencies**: Verify which contexts the component uses
3. **Maintain Type Safety**: Ensure TypeScript types are properly defined
4. **Test Permission Logic**: Verify permission checks aren't broken
5. **Preserve Arabic Comments**: Keep existing Arabic developer comments

### Working with Firebase

1. **Firestore Collections**: Check existing data structure before querying
2. **Security Rules**: Be aware of Firestore security rules
3. **Cloud Functions**: Functions are in `functions/src/`
4. **Authentication States**: Handle loading, authenticated, and unauthenticated states

### Working with Translations

The app uses i18next for internationalization:
- Translation keys are used throughout components
- Both Arabic and English are supported
- RTL layout is handled automatically

## Common Patterns

### Loading States
```typescript
const { isPageLoading, setPageLoading } = usePageLoading();
const { startAction, stopAction } = useActionLoading();
```

### Authentication Check
```typescript
const { user, isLoading, lockState } = useAuth();
```

### Permission Check
```typescript
<ProtectedRoute permissionKey="sss:13">
  <Component />
</ProtectedRoute>
```

### Navigation with Blocking
```typescript
const { setHasUnsavedChanges } = useUnsavedChanges();
// Set to true when form is dirty
setHasUnsavedChanges(true);
```

## Important Files to Review

### Configuration
- `vite.config.ts` - Build and dev server configuration
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.js` - Tailwind CSS customization
- `firebase.json` - Firebase hosting and functions config

### Entry Points
- `src/main.tsx` - Application bootstrap and context providers
- `src/App.tsx` - Routing and authentication logic
- `index.html` - HTML template

### Core Libraries
- `src/lib/firebase.ts` - Firebase initialization
- `src/lib/animations.ts` - Animation utilities
- `src/lib/imageUtils.ts` - Image processing utilities
- `src/lib/clientContext.ts` - Client context utilities

## Git Workflow

**Current Branch**: `claude/claude-md-mio1u7kfyu4wq89d-01P46XyviJ38kvh1mTqGJnpC`

### Commit Conventions
- Write clear, descriptive commit messages
- Reference the feature or fix being implemented
- Commits are in Arabic (as evidenced by git history)

### Recent Commits Pattern
```
- Full project restoration: Fixed all TS errors and structure
- وصف قصير للتعديل الذي قمت به (Short description of the modification)
```

## Testing Considerations

When implementing changes:
1. **Type Safety**: Run TypeScript compiler to check for type errors
2. **Build Test**: Run `npm run build` to ensure production build works
3. **Route Testing**: Test that new routes work with authentication
4. **Permission Testing**: Verify permission-based access works correctly
5. **Firebase Interaction**: Test Firestore queries and auth flows

## Common Pitfalls to Avoid

1. **Don't Break Context Hierarchy**: Maintain the provider nesting order in `main.tsx`
2. **Don't Skip Permission Checks**: Always use `ProtectedRoute` for authenticated routes
3. **Don't Ignore Loading States**: Always handle loading states in components
4. **Don't Hardcode Strings**: Use i18next for all user-facing text
5. **Don't Bypass TypeScript**: Avoid using `any` types; define proper interfaces
6. **Don't Forget Mobile**: Application should work on mobile devices (responsive design)
7. **Don't Skip Error Handling**: Always handle Firebase errors gracefully

## Environment Setup

Before development:
1. Ensure `.env` file exists with all Firebase credentials
2. Install dependencies: `npm install`
3. Verify Node version compatibility (TypeScript 5.9+ requirement)
4. Check Firebase project access and permissions

## Deployment

Firebase deployment process:
1. Build the project: `npm run build`
2. Deploy to Firebase: `firebase deploy`
3. Functions are pre-deployed with `npm run build` in functions directory
4. Hosting serves from `dist/` directory

## Notes for AI Assistants

1. **Always Read Before Modifying**: Never propose changes to code you haven't read
2. **Respect Existing Patterns**: Follow the established code structure and conventions
3. **Type Safety First**: Maintain TypeScript strict mode compliance
4. **Context Awareness**: Understand which contexts are available at component level
5. **Permission Model**: Always implement proper permission checks for new features
6. **Bilingual Codebase**: Respect both English and Arabic in comments/commits
7. **Firebase Integration**: Understand Firebase limitations and best practices
8. **Navigation Blocking**: Implement unsaved changes warnings for forms
9. **Loading Feedback**: Always provide visual feedback for async operations
10. **Error Handling**: Implement proper error boundaries and user feedback

## Security Considerations

1. **Authentication Required**: All routes except login require authentication
2. **Permission-Based Access**: Features are gated by permission keys
3. **Environment Variables**: Never commit `.env` file; use `import.meta.env.VITE_*`
4. **Firebase Rules**: Client-side permissions should match Firestore security rules
5. **Input Validation**: Validate all user inputs before Firebase operations

## Performance Optimization

1. **Code Splitting**: Use dynamic imports for large components
2. **Lazy Loading**: Implement lazy loading for routes where appropriate
3. **Memoization**: Use React.memo, useMemo, useCallback for expensive operations
4. **Firestore Queries**: Optimize queries with proper indexing
5. **Image Optimization**: Use appropriate image formats and sizes

---

**Last Updated**: 2025-12-02
**Project Version**: 0.0.1
**Maintained By**: Hejazi-bu
**Repository**: https://github.com/Hejazi-bu/Hejazi-SSD
