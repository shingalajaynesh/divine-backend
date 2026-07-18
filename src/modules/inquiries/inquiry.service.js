import { Op } from 'sequelize';
import {
  inquiryReplySchema,
  inquiryStatusSchema,
  submitInquirySchema,
} from './inquiry.validation.js';

export class InquiryService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async submit(input) {
    const data = submitInquirySchema.parse(input);
    const defaultCenter = await this.models.Center.findOne({ where: { isActive: true } });
    return this.models.Inquiry.create({
      ...data,
      centerId: defaultCenter?.id || null,
    });
  }

  async list({ centerId, status, search, limit = 25, offset = 0 }) {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const where = { centerId };

    if (status) where.status = inquiryStatusSchema.parse(status);
    if (search?.trim()) {
      const pattern = `%${search.trim()}%`;
      where[Op.or] = ['name', 'email', 'phone', 'city', 'message'].map((field) => ({
        [field]: { [Op.iLike]: pattern },
      }));
    }

    const { rows, count } = await this.models.Inquiry.findAndCountAll({
      where,
      include: [
        {
          model: this.models.InquiryResponse,
          as: 'responses',
          include: [{ model: this.models.User, as: 'author' }],
          separate: true,
          order: [['createdAt', 'ASC']],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: safeLimit,
      offset: safeOffset,
      distinct: true,
    });

    return { items: rows, total: count };
  }

  async updateStatus({ id, status, centerId, actorId }) {
    const safeStatus = inquiryStatusSchema.parse(status);
    const inquiry = await this.models.Inquiry.findOne({ where: { id, centerId } });
    if (!inquiry) throw new Error('Inquiry not found.');

    const currentStatus = inquiry.status;
    const allowed = {
      pending: ['in_progress', 'closed'],
      in_progress: ['resolved', 'closed'],
      resolved: ['closed'],
      closed: []
    };

    if (currentStatus !== safeStatus && !allowed[currentStatus]?.includes(safeStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${safeStatus}`);
    }

    await inquiry.update({ status: safeStatus, assignedTo: actorId });
    return inquiry;
  }

  async reply({ id, content, centerId, actorId }) {
    const safeContent = inquiryReplySchema.parse(content);
    return this.sequelize.transaction(async (transaction) => {
      const inquiry = await this.models.Inquiry.findOne({
        where: { id, centerId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!inquiry) throw new Error('Inquiry not found.');

      await this.models.InquiryResponse.create(
        { inquiryId: id, authorId: actorId, content: safeContent },
        { transaction },
      );
      await inquiry.update(
        { status: 'resolved', assignedTo: actorId },
        { transaction },
      );

      return this.models.Inquiry.findByPk(id, {
        include: [
          {
            model: this.models.InquiryResponse,
            as: 'responses',
            include: [{ model: this.models.User, as: 'author' }],
          },
        ],
        transaction,
      });
    });
  }
}
