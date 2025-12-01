/**
 * ============================================================================
 * TEST SUITE: getUserEffectivePermissions Cloud Function
 * ============================================================================
 *
 * Purpose: Tests the getUserEffectivePermissions function which retrieves
 *          all effective permissions for a user by combining job permissions
 *          and user-specific exceptions.
 *
 * Function Behavior:
 * 1. Super admins get all permissions from services, sub_services, sub_sub_services
 * 2. Regular users get job permissions + user exceptions
 * 3. User exceptions can override job permissions (add or remove)
 * 4. Always includes { general_access: true }
 *
 * @module test/getUserEffectivePermissions
 * ============================================================================
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  test,
  mockUsers,
  createCallableRequest,
  clearFirestoreCollections,
  seedFirestore,
} from './setup';

// Import the function to test
import * as myFunctions from '../src/index';

describe('═══════════════════════════════════════════════════════════', () => {
  describe('getUserEffectivePermissions() - Permission Aggregation Function', () => {
    describe('═══════════════════════════════════════════════════════════', () => {
      // -----------------------------------------------------------------------
      // Setup & Teardown
      // -----------------------------------------------------------------------

      let getUserEffectivePermissions: any;

      beforeEach(async () => {
        // Clear all Firestore data before each test
        await clearFirestoreCollections([
          'users',
          'job_permissions',
          'user_permissions',
          'services',
          'sub_services',
          'sub_sub_services',
        ]);

        // Wrap the function for testing
        getUserEffectivePermissions = test.wrap(
          myFunctions.getUserEffectivePermissions
        );
      });

      afterEach(() => {
        sinon.restore();
      });

      // =======================================================================
      // 📌 SECTION 1: Authentication Tests
      // =======================================================================
      describe('🔐 Authentication & Authorization', () => {
        it('should reject unauthenticated requests', async () => {
          const request = createCallableRequest({});

          try {
            await getUserEffectivePermissions(request);
            expect.fail('Should have thrown an error');
          } catch (error: any) {
            expect(error.code).to.equal('unauthenticated');
            expect(error.message).to.include('authenticated');
          }
        });

        it('should always include general_access permission', async () => {
          // Create a basic user
          await seedFirestore('users', [
            {
              id: 'basic-user',
              data: {
                is_super_admin: false,
                job_id: null,
                is_allowed: true,
              },
            },
          ]);

          const request = createCallableRequest({}, { uid: 'basic-user' });

          const result = await getUserEffectivePermissions(request);
          expect(result).to.have.property('general_access', true);
        });
      });

      // =======================================================================
      // 📌 SECTION 2: Super Admin Tests
      // =======================================================================
      describe('👑 Super Admin Full Access', () => {
        beforeEach(async () => {
          // Seed super admin user
          await seedFirestore('users', [
            {
              id: mockUsers.superAdmin.uid,
              data: mockUsers.superAdmin.data,
            },
          ]);
        });

        it('should return all services for super admin', async () => {
          // Seed some services
          await seedFirestore('services', [
            { id: '1', data: { name: 'Service 1' } },
            { id: '2', data: { name: 'Service 2' } },
            { id: '3', data: { name: 'Service 3' } },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.have.property('s:1', true);
          expect(result).to.have.property('s:2', true);
          expect(result).to.have.property('s:3', true);
          expect(result).to.have.property('general_access', true);
        });

        it('should return all sub-services for super admin', async () => {
          // Seed some sub-services
          await seedFirestore('sub_services', [
            { id: '10', data: { name: 'Sub-Service 10' } },
            { id: '20', data: { name: 'Sub-Service 20' } },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.have.property('ss:10', true);
          expect(result).to.have.property('ss:20', true);
        });

        it('should return all sub-sub-services for super admin', async () => {
          // Seed some sub-sub-services
          await seedFirestore('sub_sub_services', [
            { id: '100', data: { name: 'Sub-Sub-Service 100' } },
            { id: '200', data: { name: 'Sub-Sub-Service 200' } },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.have.property('sss:100', true);
          expect(result).to.have.property('sss:200', true);
        });

        it('should return complete permission set for super admin', async () => {
          // Seed all levels
          await seedFirestore('services', [
            { id: '1', data: { name: 'Service 1' } },
          ]);
          await seedFirestore('sub_services', [
            { id: '10', data: { name: 'Sub-Service 10' } },
          ]);
          await seedFirestore('sub_sub_services', [
            { id: '100', data: { name: 'Sub-Sub-Service 100' } },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.include({
            general_access: true,
            's:1': true,
            'ss:10': true,
            'sss:100': true,
          });
        });

        it('should work for super admin even with no services in database', async () => {
          // No services seeded
          const request = createCallableRequest(
            {},
            { uid: mockUsers.superAdmin.uid }
          );

          const result = await getUserEffectivePermissions(request);

          // Should still have general access
          expect(result).to.deep.equal({
            general_access: true,
          });
        });
      });

      // =======================================================================
      // 📌 SECTION 3: Job Permission Tests
      // =======================================================================
      describe('💼 Job-Based Permissions', () => {
        beforeEach(async () => {
          // Seed regular user with job
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);
        });

        it('should return job permissions for regular user', async () => {
          // Seed job permissions
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2, // matches regularUser's job_id
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: 10,
                sub_sub_service_id: null,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.include({
            general_access: true,
            's:1': true,
            'ss:10': true,
          });
        });

        it('should return only general_access when user has no job permissions', async () => {
          // No job permissions seeded
          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.equal({
            general_access: true,
          });
        });

        it('should not include permissions from other jobs', async () => {
          // Seed permissions for job 3 (not regularUser's job)
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 3,
                service_id: 5,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          // Seed permissions for job 2 (regularUser's job)
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.have.property('s:1', true);
          expect(result).to.not.have.property('s:5');
        });

        it('should handle multiple permissions at different levels', async () => {
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: 2,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: 10,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: null,
                sub_sub_service_id: 100,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.include({
            general_access: true,
            's:1': true,
            's:2': true,
            'ss:10': true,
            'sss:100': true,
          });
        });
      });

      // =======================================================================
      // 📌 SECTION 4: User Exception Tests
      // =======================================================================
      describe('⚠️ User-Specific Permission Exceptions', () => {
        beforeEach(async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);
        });

        it('should add permissions via user exceptions', async () => {
          // No job permissions, but user has exception
          await seedFirestore('user_permissions', [
            {
              data: {
                user_id: mockUsers.regularUser.uid,
                service_id: 3,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: true,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.include({
            general_access: true,
            's:3': true,
          });
        });

        it('should remove permissions via user exceptions (is_allowed: false)', async () => {
          // Job has permission
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          // User exception denies it
          await seedFirestore('user_permissions', [
            {
              data: {
                user_id: mockUsers.regularUser.uid,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: false,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.equal({
            general_access: true,
            's:1': false, // Exception overrides
          });
        });

        it('should combine job permissions and user exceptions', async () => {
          // Job permissions
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: 2,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          // User exceptions
          await seedFirestore('user_permissions', [
            {
              data: {
                user_id: mockUsers.regularUser.uid,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: false, // Deny s:1
              },
            },
            {
              data: {
                user_id: mockUsers.regularUser.uid,
                service_id: 3,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: true, // Add s:3
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.include({
            general_access: true,
            's:1': false, // Denied by exception
            's:2': true, // From job
            's:3': true, // Added by exception
          });
        });

        it('should not include other users exceptions', async () => {
          // Other user's exception
          await seedFirestore('user_permissions', [
            {
              data: {
                user_id: 'other-user-id',
                service_id: 5,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: true,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.not.have.property('s:5');
        });
      });

      // =======================================================================
      // 📌 SECTION 5: Edge Cases
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
            {},
            { uid: mockUsers.userWithoutJob.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.equal({
            general_access: true,
          });
        });

        it('should handle user with null job_id', async () => {
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

          const request = createCallableRequest({}, { uid: 'null-job-user' });

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.equal({
            general_access: true,
          });
        });

        it('should handle permissions with only service_id set', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 5,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.have.property('s:5', true);
        });

        it('should handle permissions with only sub_service_id set', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: 15,
                sub_sub_service_id: null,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.have.property('ss:15', true);
        });

        it('should handle permissions with only sub_sub_service_id set', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: null,
                sub_sub_service_id: 150,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.have.property('sss:150', true);
        });

        it('should handle malformed permission data gracefully', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          // Permission with all null IDs
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          // Should only have general_access
          expect(result).to.deep.equal({
            general_access: true,
          });
        });
      });

      // =======================================================================
      // 📌 SECTION 6: Integration & Complex Scenarios
      // =======================================================================
      describe('🔄 Complex Integration Scenarios', () => {
        it('should correctly merge all permission sources', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          // Job permissions: s:1, s:2, ss:10
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: 2,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: 10,
                sub_sub_service_id: null,
              },
            },
          ]);

          // User exceptions: deny s:1, add s:3, add sss:100
          await seedFirestore('user_permissions', [
            {
              data: {
                user_id: mockUsers.regularUser.uid,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: false,
              },
            },
            {
              data: {
                user_id: mockUsers.regularUser.uid,
                service_id: 3,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: true,
              },
            },
            {
              data: {
                user_id: mockUsers.regularUser.uid,
                service_id: null,
                sub_service_id: null,
                sub_sub_service_id: 100,
                is_allowed: true,
              },
            },
          ]);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          expect(result).to.deep.equal({
            general_access: true,
            's:1': false, // Job had it, user exception denies
            's:2': true, // From job
            's:3': true, // User exception adds
            'ss:10': true, // From job
            'sss:100': true, // User exception adds
          });
        });

        it('should handle large permission sets efficiently', async () => {
          await seedFirestore('users', [
            {
              id: mockUsers.regularUser.uid,
              data: mockUsers.regularUser.data,
            },
          ]);

          // Create 50 job permissions
          const jobPerms = [];
          for (let i = 1; i <= 50; i++) {
            jobPerms.push({
              data: {
                job_id: 2,
                service_id: i,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            });
          }
          await seedFirestore('job_permissions', jobPerms);

          const request = createCallableRequest(
            {},
            { uid: mockUsers.regularUser.uid }
          );

          const result = await getUserEffectivePermissions(request);

          // Should have all 50 permissions + general_access
          expect(Object.keys(result).length).to.equal(51);
          expect(result).to.have.property('general_access', true);
          expect(result).to.have.property('s:1', true);
          expect(result).to.have.property('s:50', true);
        });
      });
    });
  });
});
