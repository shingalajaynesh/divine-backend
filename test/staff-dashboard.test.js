import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

const STAFF_USER_ID = 's0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
const MEMBER_USER_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
const CLASS_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';
const TASK_ID = 't0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04';

test('Staff dashboard GQL queries enforce staff/admin role permissions', async () => {
  const getTasksQuery = `query { getStaffTasks { id title } }`;
  
  // 1. Should reject mother user
  const resultMother = await graphql({
    schema,
    source: getTasksQuery,
    contextValue: {
      viewer: { id: MEMBER_USER_ID, role: { roleType: 'MOTHER' } }
    }
  });
  assert.equal(resultMother.errors?.[0]?.message, 'Unauthorized');

  // 2. Should succeed for staff user
  const mockModels = {
    StaffTask: {
      findAll: async () => [
        { id: TASK_ID, title: 'Call mother for diet update', completed: false }
      ]
    }
  };

  const resultStaff = await graphql({
    schema,
    source: getTasksQuery,
    contextValue: {
      viewer: { id: STAFF_USER_ID, role: { roleType: 'STAFF' } },
      models: mockModels
    }
  });

  assert.equal(resultStaff.errors, undefined);
  assert.equal(resultStaff.data.getStaffTasks[0].title, 'Call mother for diet update');
});

test('StaffTask lifecycle resolvers handle create, toggle, and delete', async () => {
  let createdTask = null;
  let savedTask = false;
  let deletedTask = false;

  const mockModels = {
    StaffTask: {
      create: async (input) => {
        createdTask = input;
        return { id: TASK_ID, ...input, createdAt: new Date(), updatedAt: new Date() };
      },
      findByPk: async (id) => {
        if (id !== TASK_ID) return null;
        return {
          id: TASK_ID,
          staffId: STAFF_USER_ID,
          userId: MEMBER_USER_ID,
          title: 'Review medical reports',
          completed: false,
          save: async function() {
            savedTask = true;
            return this;
          },
          destroy: async () => {
            deletedTask = true;
            return true;
          }
        };
      }
    },
    User: {
      findByPk: async (id) => {
        if (id === MEMBER_USER_ID) {
          return { id: MEMBER_USER_ID, displayName: 'Sneha Sharma' };
        }
        return null;
      }
    }
  };

  // 1. Create task
  const createTaskMutation = `
    mutation {
      createStaffTask(userId: "${MEMBER_USER_ID}", title: "Call for weekly report update", description: "Vitals look normal", dueDate: "2026-07-15T00:00:00.000Z") {
        id
        title
        description
      }
    }
  `;

  const createResult = await graphql({
    schema,
    source: createTaskMutation,
    contextValue: {
      viewer: { id: STAFF_USER_ID, role: { roleType: 'STAFF' } },
      models: mockModels
    }
  });

  assert.equal(createResult.errors, undefined);
  assert.equal(createdTask.title, 'Call for weekly report update');
  assert.equal(createdTask.description, 'Vitals look normal');

  // 2. Toggle task
  const toggleTaskMutation = `
    mutation {
      toggleStaffTask(id: "${TASK_ID}") {
        id
        completed
      }
    }
  `;

  const toggleResult = await graphql({
    schema,
    source: toggleTaskMutation,
    contextValue: {
      viewer: { id: STAFF_USER_ID, role: { roleType: 'STAFF' } },
      models: mockModels
    }
  });

  assert.equal(toggleResult.errors, undefined);
  assert.equal(savedTask, true);

  // 3. Delete task
  const deleteTaskMutation = `
    mutation {
      deleteStaffTask(id: "${TASK_ID}")
    }
  `;

  const deleteResult = await graphql({
    schema,
    source: deleteTaskMutation,
    contextValue: {
      viewer: { id: STAFF_USER_ID, role: { roleType: 'STAFF' } },
      models: mockModels
    }
  });

  assert.equal(deleteResult.errors, undefined);
  assert.equal(deleteResult.data.deleteStaffTask, true);
  assert.equal(deletedTask, true);
});

test('Live class attendance tracking operations', async () => {
  let bookingCreated = null;
  let bookingSaved = false;

  const mockModels = {
    LiveClassBooking: {
      findOne: async ({ where }) => {
        if (where.userId === MEMBER_USER_ID && where.liveClassId === CLASS_ID) {
          return {
            userId: MEMBER_USER_ID,
            liveClassId: CLASS_ID,
            attended: false,
            save: async function() {
              bookingSaved = true;
              return this;
            }
          };
        }
        return null;
      },
      create: async (input) => {
        bookingCreated = input;
        return { ...input, attended: true };
      },
      findAll: async ({ where }) => {
        if (where.liveClassId === CLASS_ID) {
          return [
            { userId: MEMBER_USER_ID, liveClassId: CLASS_ID, attended: true }
          ];
        }
        return [];
      }
    },
    User: {
      findByPk: async (id) => {
        if (id === MEMBER_USER_ID) {
          return { id: MEMBER_USER_ID, displayName: 'Sneha Sharma', emailAddress: 'sneha@example.com' };
        }
        return null;
      }
    }
  };

  // 1. Query class booking list
  const getBookingsQuery = `
    query {
      getLiveClassBookings(classId: "${CLASS_ID}") {
        userId
        attended
        user {
          displayName
          emailAddress
        }
      }
    }
  `;

  const queryResult = await graphql({
    schema,
    source: getBookingsQuery,
    contextValue: {
      viewer: { id: STAFF_USER_ID, role: { roleType: 'STAFF' } },
      models: mockModels
    }
  });

  assert.equal(queryResult.errors, undefined);
  assert.equal(queryResult.data.getLiveClassBookings[0].user.displayName, 'Sneha Sharma');
  assert.equal(queryResult.data.getLiveClassBookings[0].attended, true);

  // 2. Mutate / Record class attendance
  const recordAttendanceMutation = `
    mutation {
      recordClassAttendance(classId: "${CLASS_ID}", userId: "${MEMBER_USER_ID}", attended: true) {
        userId
        attended
      }
    }
  `;

  const mutationResult = await graphql({
    schema,
    source: recordAttendanceMutation,
    contextValue: {
      viewer: { id: STAFF_USER_ID, role: { roleType: 'STAFF' } },
      models: mockModels
    }
  });

  assert.equal(mutationResult.errors, undefined);
  assert.equal(bookingSaved, true);
});

test('StaffTask updateStaffTaskStatus mutation handles transitions and updates description status prefix', async () => {
  let savedTask = false;

  const mockModels = {
    StaffTask: {
      findByPk: async (id) => {
        if (id !== TASK_ID) return null;
        return {
          id: TASK_ID,
          staffId: STAFF_USER_ID,
          userId: MEMBER_USER_ID,
          title: 'Review medical reports',
          completed: false,
          description: 'Initial task description',
          save: async function() {
            savedTask = true;
            return this;
          }
        };
      }
    }
  };

  const updateStatusMutation = `
    mutation {
      updateStaffTaskStatus(id: "${TASK_ID}", status: "IN_PROGRESS") {
        id
        status
        completed
        description
      }
    }
  `;

  const result = await graphql({
    schema,
    source: updateStatusMutation,
    contextValue: {
      viewer: { id: STAFF_USER_ID, role: { roleType: 'STAFF' } },
      models: mockModels
    }
  });

  assert.equal(result.errors, undefined);
  assert.equal(result.data.updateStaffTaskStatus.status, 'IN_PROGRESS');
  assert.equal(result.data.updateStaffTaskStatus.completed, false);
  assert.match(result.data.updateStaffTaskStatus.description, /\[STATUS:IN_PROGRESS\]/);
  assert.equal(savedTask, true);
});
