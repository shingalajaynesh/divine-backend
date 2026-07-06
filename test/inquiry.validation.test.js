import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inquiryReplySchema,
  inquiryStatusSchema,
  submitInquirySchema,
} from '../src/modules/inquiries/inquiry.validation.js';

test('accepts and normalizes a valid public inquiry', () => {
  const result = submitInquirySchema.parse({
    name: '  Pooja Sharma  ',
    email: 'pooja@example.com',
    phone: '+91 98765 43210',
    city: 'Surat',
    language: 'hi',
    message: 'Please call me.',
  });

  assert.equal(result.name, 'Pooja Sharma');
  assert.equal(result.source, 'marketing_website');
});

test('rejects invalid contact data and unsupported statuses', () => {
  assert.throws(() => submitInquirySchema.parse({ name: 'A', phone: '123', city: '' }));
  assert.throws(() => inquiryStatusSchema.parse('deleted'));
  assert.throws(() => inquiryReplySchema.parse(' '));
});
