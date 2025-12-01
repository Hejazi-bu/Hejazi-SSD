/**
 * ============================================================================
 * TEST SUITE: checkPermission Cloud Function
 * ============================================================================
 *
 * Purpose: Tests the checkPermission function which validates user access to
 *          specific services, sub-services, and sub-sub-services.
 *
 * Function Behavior:
 * 1. Super admins always have permission
 * 2. Regular users get permissions from their job role
 * 3. User-specific exceptions can override job permissions
 *
 * @module test/checkPermission
 * ============================================================================
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  test,
  mockUsers,
  mockPermissions,
  mockJobPermissions,
  mockUserPermissions,
  createCallableRequest,
  clearFirestoreCollections,
  seedFirestore,
} from './setup';

// Import the function to test
import * as myFunctions from '../src/index';

describe('═══════════════════════════════════════════════════════════', () => {
  describe('checkPermission() - Permission Validation Function', () => {
    describe('═══════════════════════════════════════════════════════════', () => {
      // -----------------------------------------------------------------------
      // Setup & Teardown
      // -----------------------------------------------------------------------

      let checkPermission: any;

      beforeEach(async () => {
        // Clear all Firestore data before each test
        await clearFirestoreCollections([
          'users',
          'job_permissions',
          'user_permissions',
        ]);

        // Wrap the function for testing
        checkPermission = test.wrap(myFunctions.checkPermission);
      });

      afterEach(() => {
        // Restore all stubs
        sinon.restore();
      });

      // =======================================================================
      // 📌 SECTION 1: Authentication Tests
      // =======================================================================
      describe('🔐 Authentication & Authorization', () => {
        it('should reject unauthenticated requests', async () => {
          const request = createCallableRequest({
            permission_id: 's:1',
          });

          try {
            await checkPermission(request);
            expect.fail('Should have thrown an error');
          } catch (error: any) {
            expect(error.code).to.equal('unauthenticated');
            expect(error.message).to.include('authenticated');
          }
        });

        it('should reject requests for non-existent users', async () => {
          const request = createCallableRequest(
            { permission_id: 's:1' },
            { uid: 'non-existent-user-id' }
          );

          try {
            await checkPermission(request);
            expect.fail('Should have thrown an error');
          } catch (error: any) {
            expect(error.code).to.equal('not-found');
            expect(error.message).to.include('User not found');
          }
        });
      });

      // =======================================================================
      // 📌 SECTION 2: Super Admin Tests
      // =======================================================================
      describe('👑 Super Admin Privileges', () => {
        beforeEach(async () => {
          // Seed super admin user
          await seedFirestore('users', [
            {
              id: mockUsers.superAdmin.uid,
              data: mockUsers.superAdmin.data,
            },
          ]);
        });

        it('should allow super admin access to any service', async () => {
          const request = createCallableRequest(
            { permission_id: mockPermissions.service },
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should allow super admin access to any sub-service', async () => {
          const request = createCallableRequest(
            { permission_id: mockPermissions.subService },
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should allow super admin access to any sub-sub-service', async () => {
          const request = createCallableRequest(
            { permission_id: mockPermissions.subSubService },
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should bypass all permission checks for super admin', async () => {
          // No job permissions exist, but super admin should still have access
          const request = createCallableRequest(
            { permission_id: 's:999' },
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });
      });

      // =======================================================================
      // 📌 SECTION 3: Job Permission Tests
      // =======================================================================
      describe('💼 Job-Based Permissions', () => {
        beforeEach(async () => {
          // Seed regular user
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);
        });

        it('should allow access when user has job permission for service', async () => {
          // Seed job permission
          await seedFirestore('job_permissions', [
            { data: mockJobPermissions.job2Service1 },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:1' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should allow access when user has job permission for sub-service', async () => {
          // Seed job permission
          await seedFirestore('job_permissions', [
            { data: mockJobPermissions.job2SubService10 },
          ]);

          const request = createCallableRequest(
            { permission_id: 'ss:10' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should deny access when user lacks job permission', async () => {
          // No job permissions seeded
          const request = createCallableRequest(
            { permission_id: 's:1' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: false });
        });

        it('should deny access when job permission exists for different service', async () => {
          // Seed permission for service 5, but request service 1
          await seedFirestore('job_permissions', [
            { data: mockJobPermissions.job3Service5 },
          ]);

          // Create user with job_id 3
          await seedFirestore('users', [
            {
              id: 'user-with-job3',
              data: { ...mockUsers.regularUser.data, job_id: 3 },
            },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:1' },
            { uid: 'user-with-job3' }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: false });
        });
      });

      // =======================================================================
      // 📌 SECTION 4: User Exception Tests
      // =======================================================================
      describe('⚠️ User-Specific Permission Exceptions', () => {
        beforeEach(async () => {
          // Seed regular user with job permission
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);
          await seedFirestore('job_permissions', [
            { data: mockJobPermissions.job2Service1 },
          ]);
        });

        it('should grant access via user exception even without job permission', async () => {
          // Remove job permission, add user exception
          await clearFirestoreCollections(['job_permissions']);
          await seedFirestore('user_permissions', [
            { data: mockUserPermissions.allowException },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:2' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should deny access via user exception overriding job permission', async () => {
          // User has job permission for s:1, but user exception denies it
          await seedFirestore('user_permissions', [
            { data: mockUserPermissions.denyException },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:1' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: false });
        });

        it('should use job permission when no user exception exists', async () => {
          // Job permission exists, no user exception
          const request = createCallableRequest(
            { permission_id: 's:1' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should prioritize user exception over job permission (allow)', async () => {
          // Clear existing job permissions
          await clearFirestoreCollections(['job_permissions']);

          // Job denies, user exception allows
          await seedFirestore('user_permissions', [
            {
              data: {
                user_id: mockUsers.regularUser.uid,
                service_id: 5,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: true,
                is_manual_exception: true,
              },
            },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:5' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });
      });

      // =======================================================================
      // 📌 SECTION 5: Permission ID Parsing Tests
      // =======================================================================
      describe('🔍 Permission ID Format Validation', () => {
        beforeEach(async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);
        });

        it('should correctly parse service permission ID (s:X)', async () => {
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 123,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:123' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should correctly parse sub-service permission ID (ss:X)', async () => {
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: 456,
                sub_sub_service_id: null,
              },
            },
          ]);

          const request = createCallableRequest(
            { permission_id: 'ss:456' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should correctly parse sub-sub-service permission ID (sss:X)', async () => {
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: null,
                sub_sub_service_id: 789,
              },
            },
          ]);

          const request = createCallableRequest(
            { permission_id: 'sss:789' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });

        it('should handle malformed permission IDs gracefully', async () => {
          const request = createCallableRequest(
            { permission_id: 'invalid:format' },
            { uid: mockUsers.regularUser.uid }
          );

          // Should not throw, but return false
          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: false });
        });
      });

      // =======================================================================
      // 📌 SECTION 6: Edge Cases
      // =======================================================================
      describe('🧪 Edge Cases & Special Scenarios', () => {
        it('should handle user without job_id', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.userWithoutJob.uid,
              data: mockUsers.userWithoutJob.data,
            },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:1' },
            { uid: mockUsers.userWithoutJob.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: false });
        });

        it('should handle null job_id gracefully', async () => {
          await seedFirestore('users', [
            {
              id: 'null-job-user',
              data: {
                is_super_admin: false,
                job_id: null,
                is_allowed: true,
              },
            },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:1' },
            { uid: 'null-job-user' }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: false });
        });

        it('should handle permission_id with special characters', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          const request = createCallableRequest(
            { permission_id: 's:1@#$%' },
            { uid: mockUsers.regularUser.uid }
          );

          // Should parse safely and return false
          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: false });
        });

        it('should handle multiple job permissions for same user', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          // Seed multiple job permissions
          await seedFirestore('job_permissions', [
            { data: mockJobPermissions.job2Service1 },
            { data: mockJobPermissions.job2SubService10 },
          ]);

          // Should find the correct one
          const request = createCallableRequest(
            { permission_id: 'ss:10' },
            { uid: mockUsers.regularUser.uid }
          );

          const result = await checkPermission(request);
          expect(result).to.deep.equal({ isAllowed: true });
        });
      });

      // =======================================================================
      // 📌 SECTION 7: Integration & Complex Scenarios
      // =======================================================================
      describe('🔄 Complex Integration Scenarios', () => {
        it('should handle complete permission hierarchy flow', async () => {
          // Setup: User with job, job permissions, and user exceptions
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          // Job allows s:1 and ss:10
          await seedFirestore('job_permissions', [
            { data: mockJobPermissions.job2Service1 },
            { data: mockJobPermissions.job2SubService10 },
          ]);

          // User exception denies s:1, allows s:2
          await seedFirestore('user_permissions', [
            { data: mockUserPermissions.denyException },
            { data: mockUserPermissions.allowException },
          ]);

          // Test 1: s:1 should be denied (user exception overrides)
          let result = await checkPermission(
            createCallableRequest(
              { permission_id: 's:1' },
              { uid: mockUsers.regularUser.uid }
            )
          );
          expect(result.isAllowed).to.be.false;

          // Test 2: ss:10 should be allowed (job permission, no exception)
          result = await checkPermission(
            createCallableRequest(
              { permission_id: 'ss:10' },
              { uid: mockUsers.regularUser.uid }
            )
          );
          expect(result.isAllowed).to.be.true;

          // Test 3: s:2 should be allowed (user exception adds it)
          result = await checkPermission(
            createCallableRequest(
              { permission_id: 's:2' },
              { uid: mockUsers.regularUser.uid }
            )
          );
          expect(result.isAllowed).to.be.true;

          // Test 4: s:3 should be denied (no permission at all)
          result = await checkPermission(
            createCallableRequest(
              { permission_id: 's:3' },
              { uid: mockUsers.regularUser.uid }
            )
          );
          expect(result.isAllowed).to.be.false;
        });
      });
    });
  });
});
