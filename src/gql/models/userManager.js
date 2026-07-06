import { v4 as uuidv4 } from 'uuid';
import { BaseManager } from './baseManager.js';

export class UserManager extends BaseManager {
  async getUserById(userId) {
    return this.models.User.findOne({
      where: {
        id: userId,
        ...(this.viewer?.centerId ? { centerId: this.viewer.centerId } : {}),
      },
      include: [
        { model: this.models.Role, as: 'role' },
        { model: this.models.Center, as: 'center' },
      ],
    });
  }

  async getUserByEmail(emailAddress) {
    return this.models.User.findOne({
      where: { emailAddress },
      include: [
        { model: this.models.Role, as: 'role' },
        { model: this.models.Center, as: 'center' },
      ],
    });
  }

  async getUsersByCenterId(isActive = true) {
    const where = { centerId: this.viewer.centerId };

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    return this.models.User.findAll({
      where,
      include: [
        { model: this.models.Role, as: 'role' },
        { model: this.models.Center, as: 'center' },
      ],
    });
  }

  async createUser(userData) {
    const {
      centerId,
      id: creatorId,
    } = this.viewer;

    return await this.models.User.create({
      id: uuidv4(),
      pwHash: Buffer.from('willbesetAuto'),
      sub: 'willbesetAuto',
      ...userData,
      centerId: centerId,
      createdBy: creatorId,
      updatedBy: creatorId,
    });
  }

  async updateUser(userData) {
    const { id: updatorId } = this.viewer;
    const userId = userData.id;
    delete userData.id;
    const user = await this.models.User.findOne({
      where: { id: userId, centerId: this.viewer.centerId },
    });
    if (!user) throw new Error('User not found in your center.');
    return user.update({ ...userData, updatedBy: updatorId });
  }

  async deleteUser(userId) {
    try {
      const row = await this.models.User.findOne({
        where: {
          id: userId,
          isSystemDefine: false,
        },
      });
      if (row) {
        this.log.info('User Deleted');
        return await row.destroy();
      } else {
        this.log.warn("User cannot be deleted.");
      }
    } catch (error) {
      this.log.error(error);
      throw error;
    }
  }

  async getUserByIdCenterRole(userId) {
    return await this.models.User.getUserByIdCenterRole(userId);
  }
}
