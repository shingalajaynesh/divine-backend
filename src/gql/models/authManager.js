import jwt from 'jsonwebtoken';
import { BaseManager } from './baseManager.js';
import { v4 as uuidv4 } from 'uuid';

export class AuthManager extends BaseManager {
  /**
   * Verifies the Clerk JWT token.
   * In a real implementation, you would fetch Clerk PEM public keys and use them to verify the token.
   * @param {string} token - Clerk session token (JWT)
   */
  async verifyClerkToken(token) {
    try {
      const tokenString = token.replace('Bearer ', '');
      
      // Decode JWT headers to see matching key ID
      const decodedToken = jwt.decode(tokenString, { complete: true });
      if (!decodedToken) {
        throw new Error('Invalid token format');
      }

      // In production, Clerk JWT verification is done using Clerk's JSON Web Key Set (JWKS)
      // For development, we extract the claims and mock verification, or check CLERK_JWT_KEY
      const clerkKey = process.env.CLERK_JWT_KEY;
      if (clerkKey) {
        // RS256 or custom key check
        const verified = jwt.verify(tokenString, clerkKey);
        return { valid: true, decoded: verified };
      }

      // Fallback/Demo: return decoded if CLERK_JWT_KEY is not defined yet
      return { valid: true, decoded: decodedToken.payload };
    } catch (error) {
      this.log.error('Clerk token verification failed:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Synchronizes user data received from Clerk Webhook (e.g. user.created or user.updated)
   * @param {Object} clerkUser - User data payload from Clerk webhook
   */
  async syncClerkUser(clerkUser) {
    const { id: clerkId, email_addresses, first_name, last_name, image_url } = clerkUser;
    const emailAddress = email_addresses?.[0]?.email_address;

    if (!emailAddress) {
      throw new Error('Email address is required to sync Clerk user');
    }

    try {
      const { User, Center, Role } = this.models;

      // Find or create a default Garbh Sanskar Center
      let defaultCenter = await Center.findOne();
      if (!defaultCenter) {
        defaultCenter = await Center.create({
          id: uuidv4(),
          name: "Default Divine Garbh Sanskar Center",
          emailAddress: "info@divinegarbhsanskar.com",
          contactno: "0000000000",
          isActive: true
        });
      }

      // Find or create a default role for newly registered Mothers/Parents
      let motherRole = await Role.findOne({ where: { roleType: 'MOTHER' } });
      if (!motherRole) {
        motherRole = await Role.create({
          id: uuidv4(),
          name: "Mother",
          description: "Default Mother Role",
          roleType: "MOTHER",
          centerId: defaultCenter.id,
          isSystemDefine: true,
          createdBy: "00000000-0000-0000-0000-000000000000",
          updatedBy: "00000000-0000-0000-0000-000000000000"
        });
      }

      // Check if user exists by clerkId or email
      let user = await User.findOne({ where: { clerkId } });
      if (!user) {
        user = await User.findOne({ where: { emailAddress } });
      }

      if (user) {
        // Update user
        await user.update({
          clerkId,
          firstName: first_name,
          lastName: last_name,
          displayName: `${first_name || ''} ${last_name || ''}`.trim() || emailAddress.split('@')[0],
          updated: new Date()
        });
        this.log.info('Synced and updated Clerk user locally:', { emailAddress, clerkId });
      } else {
        // Create user
        user = await User.create({
          id: uuidv4(),
          clerkId,
          sub: clerkId,
          emailAddress,
          pwHash: Buffer.from('clerk-managed'),
          firstName: first_name,
          lastName: last_name,
          displayName: `${first_name || ''} ${last_name || ''}`.trim() || emailAddress.split('@')[0],
          centerId: defaultCenter.id,
          roleId: motherRole.id,
          isActive: true,
          inserted: new Date(),
          updated: new Date()
        });
        this.log.info('Created new Clerk user locally:', { emailAddress, clerkId });
      }
      return user;
    } catch (error) {
      this.log.error('Failed to sync Clerk user:', error);
      throw error;
    }
  }

  /**
   * Deletes local user matching clerkId when deleted from Clerk
   * @param {string} clerkId - Clerk user ID
   */
  async deleteClerkUser(clerkId) {
    try {
      const user = await this.models.User.findOne({ where: { clerkId } });
      if (user) {
        await user.destroy();
        this.log.info('Deleted Clerk user locally:', { clerkId });
        return true;
      }
      return false;
    } catch (error) {
      this.log.error('Failed to delete Clerk user:', error);
      throw error;
    }
  }
}
