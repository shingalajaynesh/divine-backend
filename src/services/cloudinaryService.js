import crypto from 'crypto';
import Logger from '../util/logger.js';

const log = new Logger('CloudinaryService');

export class CloudinaryService {
  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'divine-garbh';
    this.apiKey = process.env.CLOUDINARY_API_KEY || 'mock_key';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || 'mock_secret';
  }

  /**
   * Generates a signed upload signature for secure client-side uploads
   * @param {Object} params - Parameters to sign (e.g. folder, public_id, timestamp)
   * @returns {Object} - Object containing signature, timestamp, apiKey, and cloudName
   */
  generateUploadSignature(params = {}) {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signatureParams = {
      ...params,
      timestamp
    };

    // Remove empty parameters
    Object.keys(signatureParams).forEach(key => {
      if (signatureParams[key] === undefined || signatureParams[key] === null || signatureParams[key] === '') {
        delete signatureParams[key];
      }
    });

    // Cloudinary signature rules: sort keys, join key=value with &, append secret, then SHA1 hex hash
    const sortedKeys = Object.keys(signatureParams).sort();
    const serialized = sortedKeys.map(k => `${k}=${signatureParams[k]}`).join('&');
    const toHash = serialized + this.apiSecret;

    const signature = crypto.createHash('sha1').update(toHash).digest('hex');

    log.info(`Generated upload signature for parameters: ${sortedKeys.join(', ')}`);

    return {
      signature,
      timestamp,
      apiKey: this.apiKey,
      cloudName: this.cloudName
    };
  }

  /**
   * Generates transformed delivery URLs (e.g. resize, quality optimization, WebP format)
   * @param {string} publicId - The public ID of the resource in Cloudinary
   * @param {string} transforms - Transformation string (e.g. 'w_400,h_400,c_fill,q_auto,f_auto')
   * @param {string} resourceType - image, video, raw
   * @returns {string} - Cloudinary transformation URL
   */
  getTransformUrl(publicId, transforms = 'q_auto,f_auto', resourceType = 'image') {
    if (!publicId) return '';
    if (publicId.startsWith('http')) return publicId; // Fallback for full URLs
    return `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${transforms}/${publicId}`;
  }

  /**
   * Generates a video poster/thumbnail URL from a video asset
   * @param {string} publicId - The public ID of the video in Cloudinary
   * @returns {string} - Video poster image URL
   */
  getVideoPosterUrl(publicId) {
    if (!publicId) return '';
    return this.getTransformUrl(publicId, 'so_auto,f_jpg', 'video');
  }

  /**
   * Generates a signed secure delivery URL for restricted assets (e.g. premium videos/audios)
   * @param {string} publicId - Public ID
   * @param {number} expirySeconds - Time to live in seconds
   * @param {string} resourceType - image, video, raw
   * @returns {string} - Signed URL with expiration token
   */
  getSecureDeliveryUrl(publicId, expirySeconds = 3600, resourceType = 'video') {
    if (!publicId) return '';
    if (publicId.startsWith('http')) return publicId;

    const expireTimestamp = Math.round(new Date().getTime() / 1000) + expirySeconds;
    const path = `${resourceType}/upload/${publicId}`;
    const stringToSign = `${path}#${expireTimestamp}#${this.apiSecret}`;
    
    // Cloudinary secure token signature
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    return `https://res.cloudinary.com/${this.cloudName}/${path}?token=exp=${expireTimestamp}~hmac=${signature}`;
  }
}
