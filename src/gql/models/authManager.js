import { BaseManager } from './baseManager.js';
import { v4 as uuidv4 } from 'uuid';

export class AuthManager extends BaseManager {
  async syncFirebaseUser(firebaseUser) {
    if (!firebaseUser?.uid) throw new Error('Verified Firebase identity is required');
    const firebaseUid = firebaseUser.uid;
    let emailAddress = firebaseUser.email?.trim().toLowerCase() || null;
    
    // Auto-generate placeholder email if user logged in via phone auth only
    if (!emailAddress) {
      if (firebaseUser.phone_number) {
        emailAddress = `${firebaseUser.phone_number.replace('+', '')}@firebase.local`;
      } else {
        emailAddress = `${firebaseUid}@firebase.local`;
      }
    }

    let firstName = null;
    let lastName = null;
    if (firebaseUser.name) {
      const parts = firebaseUser.name.trim().split(/\s+/);
      firstName = parts[0] || null;
      if (parts.length > 1) {
        lastName = parts.slice(1).join(' ') || null;
      }
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

      // Find or create a default role for newly registered Partners
      let partnerRole = await Role.findOne({ where: { roleType: 'PARTNER' } });
      if (!partnerRole) {
        partnerRole = await Role.create({
          id: uuidv4(),
          name: "Partner",
          description: "Default Partner Role",
          roleType: "PARTNER",
          centerId: defaultCenter.id,
          isSystemDefine: true,
          createdBy: "00000000-0000-0000-0000-000000000000",
          updatedBy: "00000000-0000-0000-0000-000000000000"
        });
      }

      let user = await User.findOne({ where: { firebaseUid } });

      // A verified email may safely link a pre-Firebase account during migration.
      if (!user && firebaseUser.email_verified && emailAddress) {
        user = await User.findOne({ where: { emailAddress, firebaseUid: null } });
      }

      const mobileNo = firebaseUser.phone_number || null;

      if (user) {
        // Update user
        await user.update({
          firebaseUid,
          firstName: user.firstName || firstName,
          lastName: user.lastName || lastName,
          mobileNo: mobileNo || user.mobileNo,
          displayName: user.displayName || `${firstName || ''} ${lastName || ''}`.trim() || emailAddress.split('@')[0],
          updated: new Date()
        });
        this.log.info('Synced and updated Firebase user locally:', { emailAddress: '[REDACTED]', firebaseUid });
      } else {
        // Create user
        user = await User.create({
          id: uuidv4(),
          firebaseUid,
          sub: firebaseUid,
          emailAddress,
          pwHash: Buffer.from('firebase-managed'),
          firstName,
          lastName,
          mobileNo,
          displayName: `${firstName || ''} ${lastName || ''}`.trim() || emailAddress.split('@')[0],
          centerId: defaultCenter.id,
          roleId: motherRole.id,
          isActive: true,
          inserted: new Date(),
          updated: new Date()
        });
        this.log.info('Created new Firebase user locally:', { emailAddress: '[REDACTED]', firebaseUid });
      }
      return user;
    } catch (error) {
      this.log.error('Failed to sync Firebase user:', error);
      throw error;
    }
  }

  /**
   * Deletes local user matching firebaseUid when deleted from Firebase
   * @param {string} firebaseUid - Firebase user ID
   */
  async deleteFirebaseUser(firebaseUid) {
    try {
      const user = await this.models.User.findOne({ where: { firebaseUid } });
      if (user) {
        await user.destroy();
        this.log.info('Deleted Firebase user locally:', { firebaseUid });
        return true;
      }
      return false;
    } catch (error) {
      this.log.error('Failed to delete Firebase user:', error);
      throw error;
    }
  }
}
