import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { CloudinaryService } from '../src/services/cloudinaryService.js';

test('CloudinaryService generates correct URL transformations, poster URL, and secure tokens', () => {
  const service = new CloudinaryService();
  
  // Set mock secrets
  service.cloudName = 'test-cloud';
  service.apiKey = 'test-key';
  service.apiSecret = 'test-secret';

  // 1. Signature generation
  const res = service.generateUploadSignature({ folder: 'profile_pics' });
  assert.ok(res.signature);
  assert.ok(res.timestamp);
  assert.equal(res.apiKey, 'test-key');
  assert.equal(res.cloudName, 'test-cloud');

  // 2. Transform URL
  const imgUrl = service.getTransformUrl('avatar123', 'w_100,h_100,c_fill');
  assert.equal(imgUrl, 'https://res.cloudinary.com/test-cloud/image/upload/w_100,h_100,c_fill/avatar123');

  // 3. Video Poster
  const posterUrl = service.getVideoPosterUrl('webinar999');
  assert.equal(posterUrl, 'https://res.cloudinary.com/test-cloud/video/upload/so_auto,f_jpg/webinar999');

  // 4. Secure delivery URL
  const secureUrl = service.getSecureDeliveryUrl('premium_class_4k');
  assert.ok(secureUrl.includes('https://res.cloudinary.com/test-cloud/video/upload/premium_class_4k?token=exp='));
  assert.ok(secureUrl.includes('~hmac='));
});

test('GraphQL getCloudinarySignature query runs successfully', async () => {
  const query = `
    query GetCloudinarySignature($folder: String!) {
      getCloudinarySignature(folder: $folder) {
        signature
        timestamp
        apiKey
        cloudName
      }
    }
  `;

  const viewer = { id: 'staff-1', role: { roleType: 'STAFF' }, centerId: 'center-100' };

  const result = await graphql({
    schema,
    source: query,
    variableValues: { folder: 'vitals_evidence' },
    contextValue: { viewer, models: {}, sequelize: {} }
  });

  assert.equal(result.errors, undefined);
  const signatureData = result.data.getCloudinarySignature;
  assert.ok(signatureData.signature);
  assert.ok(signatureData.timestamp);
  assert.ok(signatureData.apiKey);
  assert.ok(signatureData.cloudName);
});
