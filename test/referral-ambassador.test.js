import assert from 'node:assert/strict';
import test from 'node:test';
import { ReferralService } from '../src/modules/referral/referral.service.js';

const VIEWER_STAFF = { id: 'staff-uuid-1', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: 'mother-uuid-1', role: { roleType: 'MOTHER' } };
const OTHER_MOTHER = { id: 'mother-uuid-2', role: { roleType: 'MOTHER' } };

test('ReferralService pipelines, testimonial review moderation, and ambassador applications', async () => {
  const mockReferrals = [];
  const mockTestimonials = [];
  const mockAmbassadors = [];

  const mockUsers = [
    { id: 'mother-uuid-1', displayName: 'Jane Doe', emailAddress: 'jane@example.com' },
    { id: 'mother-uuid-2', displayName: 'Sara Smith', emailAddress: 'sara@example.com' }
  ];

  const mockModels = {
    UserReferral: {
      create: async (input) => {
        const row = {
          ...input,
          update: async function(updates) {
            Object.assign(this, updates);
            return this;
          }
        };
        mockReferrals.push(row);
        return row;
      },
      findByPk: async (id) => mockReferrals.find(r => r.id === id) || null,
      findAll: async (options) => {
        if (options?.where?.referrerId) {
          return mockReferrals.filter(r => r.referrerId === options.where.referrerId);
        }
        return mockReferrals.map(r => {
          const refUser = mockUsers.find(u => u.id === r.referrerId);
          return { ...r, referrer: refUser };
        });
      }
    },
    Testimonial: {
      create: async (input) => {
        const row = {
          ...input,
          update: async function(updates) {
            Object.assign(this, updates);
            return this;
          }
        };
        mockTestimonials.push(row);
        return row;
      },
      findByPk: async (id) => mockTestimonials.find(t => t.id === id) || null,
      findAll: async (options) => {
        let list = mockTestimonials;
        if (options?.where?.status) {
          list = list.filter(t => t.status === options.where.status);
        }
        return list.map(t => {
          const u = mockUsers.find(user => user.id === t.userId);
          return { ...t, user: u };
        });
      }
    },
    AmbassadorApplication: {
      create: async (input) => {
        const row = {
          ...input,
          update: async function(updates) {
            Object.assign(this, updates);
            return this;
          }
        };
        mockAmbassadors.push(row);
        return row;
      },
      findOne: async (options) => {
        const { userId, status } = options.where;
        return mockAmbassadors.find(a => a.userId === userId && a.status === status) || null;
      },
      findByPk: async (id) => mockAmbassadors.find(a => a.id === id) || null,
      findAll: async () => {
        return mockAmbassadors.map(a => {
          const u = mockUsers.find(user => user.id === a.userId);
          return { ...a, user: u };
        });
      }
    },
    User: {
      findByPk: async (id) => mockUsers.find(u => u.id === id) || null
    }
  };

  const mockSequelize = {};
  const service = new ReferralService(mockModels, mockSequelize);

  // --- Test Case 1: Referrals Pipeline ---
  // Submit Referral
  const ref = await service.submitReferral(VIEWER_MOTHER, {
    refereeName: 'Deepa Patel',
    refereeEmail: 'deepa@example.com',
    refereePhone: '9876543210'
  });
  assert.equal(ref.refereeName, 'Deepa Patel');
  assert.equal(ref.status, 'pending');
  assert.equal(mockReferrals.length, 1);

  // Get own referrals
  const myRefs = await service.getMyReferrals(VIEWER_MOTHER);
  assert.equal(myRefs.length, 1);

  // Staff reads report
  const report = await service.getReferralsReport(VIEWER_STAFF);
  assert.equal(report.length, 1);
  assert.equal(report[0].referrer.displayName, 'Jane Doe');

  // Convert referral
  await assert.rejects(
    service.convertReferral(VIEWER_MOTHER, ref.id, 100),
    /Unauthorized access/
  );

  const convertedRef = await service.convertReferral(VIEWER_STAFF, ref.id, 150);
  assert.equal(convertedRef.status, 'converted');
  assert.equal(convertedRef.rewardPoints, 150);

  // --- Test Case 2: Testimonials Moderation ---
  // Submit Testimonial validation
  await assert.rejects(
    service.submitTestimonial(VIEWER_MOTHER, { content: 'Nice', rating: 6 }),
    /Rating must be between 1 and 5/
  );

  const testimonial = await service.submitTestimonial(VIEWER_MOTHER, {
    content: 'The program changed my lifestyle!',
    rating: 5
  });
  assert.equal(testimonial.content, 'The program changed my lifestyle!');
  assert.equal(testimonial.status, 'pending');

  // Query as mother (should only return approved)
  const approvedOnly = await service.getTestimonials(VIEWER_MOTHER);
  assert.equal(approvedOnly.length, 0); // none approved yet

  // Moderate Testimonial
  await assert.rejects(
    service.moderateTestimonial(VIEWER_MOTHER, testimonial.id, 'approved'),
    /Unauthorized access/
  );

  const moderated = await service.moderateTestimonial(VIEWER_STAFF, testimonial.id, 'approved');
  assert.equal(moderated.status, 'approved');

  // Query as mother again
  const approvedNow = await service.getTestimonials(VIEWER_MOTHER);
  assert.equal(approvedNow.length, 1);
  assert.equal(approvedNow[0].user.displayName, 'Jane Doe');

  // --- Test Case 3: Ambassador Applications ---
  const app = await service.applyForAmbassador(VIEWER_MOTHER, {
    socialLinks: { instagram: 'https://instagr.am/jane' },
    reason: 'I want to share my journey with others'
  });
  assert.equal(app.status, 'pending');

  // Check duplicate
  await assert.rejects(
    service.applyForAmbassador(VIEWER_MOTHER, { reason: 'Duplicate' }),
    /You already have a pending application/
  );

  // Get applications
  const apps = await service.getAmbassadorApplications(VIEWER_STAFF);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].user.displayName, 'Jane Doe');

  // Moderate Application
  const moderatedApp = await service.moderateAmbassadorApplication(VIEWER_STAFF, app.id, 'approved');
  assert.equal(moderatedApp.status, 'approved');
});
