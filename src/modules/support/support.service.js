import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(4).max(150),
  description: z.string().min(10).max(5000),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  category: z.string().max(100).optional()
});

export const addMessageSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().min(1).max(2000)
});

export const closeTicketSchema = z.object({
  ticketId: z.string().uuid(),
  satisfactionScore: z.number().int().min(1).max(5).optional(),
  satisfactionFeedback: z.string().max(1000).optional()
});

export class SupportService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async createTicket(userId, input) {
    const data = createTicketSchema.parse(input);
    const priority = data.priority || 'medium';
    
    // SLA duration based on priority
    let hours = 12;
    if (priority === 'high') hours = 4;
    else if (priority === 'low') hours = 24;

    const slaExpiresAt = new Date();
    slaExpiresAt.setHours(slaExpiresAt.getHours() + hours);

    return this.sequelize.transaction(async (t) => {
      const ticket = await this.models.SupportTicket.create({
        userId,
        subject: data.subject,
        description: data.description,
        status: 'open',
        priority,
        category: data.category || 'general',
        slaExpiresAt
      }, { transaction: t });

      // Append initial message
      await this.models.SupportTicketMessage.create({
        ticketId: ticket.id,
        senderId: userId,
        senderType: 'user',
        message: data.description
      }, { transaction: t });

      return ticket;
    });
  }

  async getTickets(userId) {
    return this.models.SupportTicket.findAll({
      where: { userId },
      include: [
        {
          model: this.models.SupportTicketMessage,
          as: 'messages',
          include: [{ model: this.models.User, as: 'sender', attributes: ['displayName'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async getTicketDetails(userId, id) {
    const ticketId = z.string().uuid().parse(id);
    return this.models.SupportTicket.findOne({
      where: { id: ticketId, userId },
      include: [
        {
          model: this.models.SupportTicketMessage,
          as: 'messages',
          include: [{ model: this.models.User, as: 'sender', attributes: ['displayName'] }]
        }
      ],
      order: [
        [{ model: this.models.SupportTicketMessage, as: 'messages' }, 'createdAt', 'ASC']
      ]
    });
  }

  async addMessage(userId, input, senderType = 'user') {
    const data = addMessageSchema.parse(input);
    
    const ticket = await this.models.SupportTicket.findOne({
      where: { id: data.ticketId, userId }
    });
    if (!ticket) throw new Error('Ticket not found');

    return this.sequelize.transaction(async (t) => {
      const msg = await this.models.SupportTicketMessage.create({
        ticketId: data.ticketId,
        senderId: userId,
        senderType,
        message: data.message
      }, { transaction: t });

      // Re-open ticket if it was closed or pending when user replies
      if (senderType === 'user' && ticket.status !== 'open') {
        ticket.status = 'open';
        await ticket.save({ transaction: t });
      }

      return msg;
    });
  }

  async closeTicket(userId, input) {
    const data = closeTicketSchema.parse(input);

    const ticket = await this.models.SupportTicket.findOne({
      where: { id: data.ticketId, userId }
    });
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = 'resolved';
    if (data.satisfactionScore !== undefined) {
      ticket.satisfactionScore = data.satisfactionScore;
    }
    if (data.satisfactionFeedback !== undefined) {
      ticket.satisfactionFeedback = data.satisfactionFeedback;
    }
    await ticket.save();

    return ticket;
  }

  async requestWhatsappHandoff(userId, id) {
    const ticketId = z.string().uuid().parse(id);
    const ticket = await this.models.SupportTicket.findOne({
      where: { id: ticketId, userId }
    });
    if (!ticket) throw new Error('Ticket not found');

    ticket.whatsappHandoffRequested = true;
    await ticket.save();
    return ticket;
  }
}
