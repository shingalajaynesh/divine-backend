import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('public inquiry mutation validates and persists through the GraphQL schema', async () => {
  const createdAt = new Date();
  const contextValue = {
    models: {
      Center: { findOne: async () => ({ id: 'center-1' }) },
      Inquiry: {
        create: async (input) => ({
          id: 'inquiry-1',
          status: 'pending',
          createdAt,
          updatedAt: createdAt,
          ...input,
        }),
      },
      InquiryResponse: { findAll: async () => [] },
    },
  };

  const result = await graphql({
    schema,
    contextValue,
    source: `
      mutation SubmitInquiry($input: SubmitInquiryInput!) {
        submitInquiry(input: $input) { id status name phone }
      }
    `,
    variableValues: {
      input: {
        name: 'Pooja Sharma',
        phone: '+919876543210',
        city: 'Surat',
        language: 'en',
      },
    },
  });

  assert.equal(result.errors, undefined);
  assert.deepEqual({ ...result.data.submitInquiry }, {
    id: 'inquiry-1',
    status: 'pending',
    name: 'Pooja Sharma',
    phone: '+919876543210',
  });
});
