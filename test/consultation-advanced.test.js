import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Consultation advanced intake forms, prescriptions, documents, and follow-ups', async () => {
  const getConsultationsQuery = `
    query GetMyConsultations {
      getMyConsultations {
        id
        status
        caseNotes
        followUpTasks
        intakeForm
        prescriptions
        documents
        followUpDate
      }
    }
  `;

  const submitIntakeFormMutation = `
    mutation SubmitIntakeForm($bookingId: ID!, $symptoms: [String!]!, $gestationalWeeks: Int!, $concerns: String!, $medicalHistory: String) {
      submitIntakeForm(bookingId: $bookingId, symptoms: $symptoms, gestationalWeeks: $gestationalWeeks, concerns: $concerns, medicalHistory: $medicalHistory) {
        id
        intakeForm
      }
    }
  `;

  const submitCaseNotesMutation = `
    mutation SubmitCaseNotes($input: SubmitCaseNotesInput!) {
      submitCaseNotes(input: $input) {
        id
        caseNotes
        followUpTasks
        prescriptions
        documents
        followUpDate
      }
    }
  `;

  // Mock database records
  const mockBooking = {
    id: 'da70bc6c-1394-44e8-9898-e5d823664484',
    userId: 'mother-1',
    expertId: 'doctor-1',
    scheduleSlot: new Date('2026-07-10T10:00:00Z'),
    videoCallUrl: 'https://meet.google.com/abc',
    status: 'confirmed',
    caseNotes: null,
    followUpTasks: null,
    intakeForm: null,
    prescriptions: null,
    documents: null,
    followUpDate: null,
    save: async function() {
      return this;
    }
  };

  const mockModels = {
    ConsultationBooking: {
      findOne: async (options) => {
        const where = options.where;
        if (where.id === mockBooking.id) {
          if (where.userId && where.userId !== mockBooking.userId) return null;
          if (where.expertId && where.expertId !== mockBooking.expertId) return null;
          return mockBooking;
        }
        return null;
      },
      findByPk: async (id) => {
        if (id === mockBooking.id) return mockBooking;
        return null;
      },
      findAll: async (options) => {
        const where = options.where;
        if (where.userId === 'mother-1' || where.expertId === 'doctor-1') {
          return [mockBooking];
        }
        return [];
      }
    },
    User: {
      findByPk: async (id) => {
        return { id, displayName: id === 'mother-1' ? 'Mother Jane' : 'Doctor Priya' };
      }
    }
  };

  const { ConsultationService } = await import('../src/modules/consultation/consultation.service.js');

  const runQuery = async (source, variables, viewer) => {
    const service = new ConsultationService(mockModels, {});
    return graphql({
      schema,
      source,
      variableValues: variables,
      contextValue: { viewer, models: mockModels, sequelize: {}, consultationService: service }
    });
  };

  const motherViewer = { id: 'mother-1', role: { roleType: 'MOTHER' }, centerId: 'center-1' };
  const doctorViewer = { id: 'doctor-1', role: { roleType: 'GUIDE' }, centerId: 'center-1' };
  const strangerViewer = { id: 'stranger-1', role: { roleType: 'MOTHER' }, centerId: 'center-1' };

  // Test Case 1: Stranger cannot submit intake form for booking-1
  const res1 = await runQuery(submitIntakeFormMutation, {
    bookingId: 'da70bc6c-1394-44e8-9898-e5d823664484',
    symptoms: ['Nausea', 'Fatigue'],
    gestationalWeeks: 14,
    concerns: 'Mild abdominal discomfort',
    medicalHistory: 'First pregnancy, healthy'
  }, strangerViewer);
  assert.ok(res1.errors && res1.errors.length > 0);
  assert.match(res1.errors[0].message, /Consultation booking not found/);

  // Test Case 2: Mother Jane submits intake form successfully
  const res2 = await runQuery(submitIntakeFormMutation, {
    bookingId: 'da70bc6c-1394-44e8-9898-e5d823664484',
    symptoms: ['Nausea', 'Fatigue'],
    gestationalWeeks: 14,
    concerns: 'Mild abdominal discomfort',
    medicalHistory: 'First pregnancy, healthy'
  }, motherViewer);
  assert.equal(res2.errors, undefined);
  assert.ok(res2.data.submitIntakeForm.intakeForm);
  const parsedIntake = JSON.parse(res2.data.submitIntakeForm.intakeForm);
  assert.equal(parsedIntake.gestationalWeeks, 14);
  assert.equal(parsedIntake.concerns, 'Mild abdominal discomfort');
  assert.deepEqual(parsedIntake.symptoms, ['Nausea', 'Fatigue']);

  // Test Case 3: Doctor submits clinical notes, prescriptions list, documents list, and follow-up target
  const res3 = await runQuery(submitCaseNotesMutation, {
    input: {
      bookingId: 'da70bc6c-1394-44e8-9898-e5d823664484',
      caseNotes: 'Maternal health looks good. BP normal.',
      followUpTasks: ['Rest well', 'Walk 20 mins daily'],
      prescriptions: JSON.stringify([{ name: 'Iron supplement', dosage: 'Once daily', durationDays: 30 }]),
      documents: JSON.stringify([{ name: 'Blood panel report', url: 'https://cloud.com/report1.pdf' }]),
      followUpDate: '2026-07-20'
    }
  }, doctorViewer);
  assert.equal(res3.errors, undefined);
  const updatedBooking = res3.data.submitCaseNotes;
  assert.equal(updatedBooking.caseNotes, 'Maternal health looks good. BP normal.');
  assert.equal(updatedBooking.followUpDate, '2026-07-20');
  
  const parsedMeds = JSON.parse(updatedBooking.prescriptions);
  assert.equal(parsedMeds[0].name, 'Iron supplement');
  assert.equal(parsedMeds[0].durationDays, 30);

  const parsedDocs = JSON.parse(updatedBooking.documents);
  assert.equal(parsedDocs[0].name, 'Blood panel report');
  assert.equal(parsedDocs[0].url, 'https://cloud.com/report1.pdf');

  // Test Case 4: Invalid prescriptions string format is rejected
  const res4 = await runQuery(submitCaseNotesMutation, {
    input: {
      bookingId: 'da70bc6c-1394-44e8-9898-e5d823664484',
      caseNotes: 'Maternal health looks good. BP normal.',
      prescriptions: 'not-a-json-array'
    }
  }, doctorViewer);
  assert.ok(res4.errors && res4.errors.length > 0);
  assert.match(res4.errors[0].message, /Invalid prescriptions format/);

  // Test Case 5: Mother Jane queries consultations and gets all clinical recommendations details
  const res5 = await runQuery(getConsultationsQuery, {}, motherViewer);
  assert.equal(res5.errors, undefined);
  const cList = res5.data.getMyConsultations;
  assert.equal(cList.length, 1);
  assert.equal(cList[0].caseNotes, 'Maternal health looks good. BP normal.');
  assert.equal(cList[0].followUpDate, '2026-07-20');
  assert.ok(cList[0].prescriptions);
  assert.ok(cList[0].documents);
});
