import { BaseManager } from './baseManager.js';
import { v4 as uuidv4 } from 'uuid';
import { createClerkClient } from '@clerk/express';

export class AuthManager extends BaseManager {
  /**
   * Fetches the authenticated Clerk user server-side before synchronizing it.
   * Client-provided identity payloads are intentionally never trusted.
   */
  async syncClerkUserById(clerkId) {
    if (!clerkId) throw new Error('Verified Clerk user ID is required');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(clerkId);
    return this.syncClerkUser(clerkUser);
  }

  async syncClerkUser(clerkUser) {
    const clerkId = clerkUser.id;
    const primaryEmail = clerkUser.emailAddresses?.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    );
    const emailAddress = (primaryEmail || clerkUser.emailAddresses?.[0])?.emailAddress
      ?.trim()
      .toLowerCase();
    const firstName = clerkUser.firstName?.trim() || null;
    const lastName = clerkUser.lastName?.trim() || null;

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

      // Clerk ID is the only automatic account-linking key.
      let user = await User.findOne({ where: { clerkId } });
      if (!user) {
        const conflictingEmailUser = await User.findOne({ where: { emailAddress } });
        if (conflictingEmailUser) {
          throw new Error('An account with this email already exists. Contact support to link it securely.');
        }
      }

      if (user) {
        // Update user
        await user.update({
          clerkId,
          firstName,
          lastName,
          displayName: `${firstName || ''} ${lastName || ''}`.trim() || emailAddress.split('@')[0],
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
          firstName,
          lastName,
          displayName: `${firstName || ''} ${lastName || ''}`.trim() || emailAddress.split('@')[0],
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
