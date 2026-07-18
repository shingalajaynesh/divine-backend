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
    const tickets = await this.models.SupportTicket.findAll({
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
    tickets.forEach(ticket => {
      if (ticket.messages) {
        ticket.messages = ticket.messages.filter(m => !m.message.startsWith('[INTERNAL]'));
      }
    });
    return tickets;
  }

  async getTicketDetails(userId, id) {
    const ticketId = z.string().uuid().parse(id);
    const ticket = await this.models.SupportTicket.findOne({
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
    if (ticket && ticket.messages) {
      ticket.messages = ticket.messages.filter(m => !m.message.startsWith('[INTERNAL]'));
    }
    return ticket;
  }

  async getStaffTickets(viewer, status) {
    const where = {};
    if (status) {
      where.status = status;
    }

    const userInclude = {
      model: this.models.User,
      as: 'user',
      attributes: ['displayName', 'centerId']
    };

    // Filter by staff center if not super admin
    if (viewer.role?.roleType !== 'SUPER_ADMIN' && viewer.centerId) {
      userInclude.where = { centerId: viewer.centerId };
    }

    return this.models.SupportTicket.findAll({
      where,
      include: [
        userInclude,
        {
          model: this.models.SupportTicketMessage,
          as: 'messages',
          include: [{ model: this.models.User, as: 'sender', attributes: ['displayName'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async getCannedReplies() {
    return this.models.CannedReply.findAll({
      order: [['title', 'ASC']]
    });
  }

  async createCannedReply(input) {
    const { title, content, category } = z.object({
      title: z.string().min(3).max(100),
      content: z.string().min(5).max(2000),
      category: z.string().max(50)
    }).parse(input);

    return this.models.CannedReply.create({
      title,
      content,
      category
    });
  }

  async getSupportDashboardMetrics(viewer) {
    const userInclude = {
      model: this.models.User,
      as: 'user'
    };

    if (viewer.role?.roleType !== 'SUPER_ADMIN' && viewer.centerId) {
      userInclude.where = { centerId: viewer.centerId };
    }

    const tickets = await this.models.SupportTicket.findAll({
      include: [userInclude]
    });

    const total = tickets.length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    const pending = tickets.filter(t => t.status === 'pending' || t.status === 'open').length;
    
    const now = new Date();
    const breached = tickets.filter(t => t.slaBreached === true || (t.status !== 'resolved' && t.status !== 'closed' && new Date(t.slaExpiresAt) < now)).length;
    
    const ratedTickets = tickets.filter(t => t.satisfactionScore !== null && t.satisfactionScore !== undefined);
    const avgScore = ratedTickets.length > 0
      ? ratedTickets.reduce((sum, t) => sum + t.satisfactionScore, 0) / ratedTickets.length
      : null;

    const distribution = [1, 2, 3, 4, 5].map(score => ({
      score,
      count: tickets.filter(t => t.satisfactionScore === score).length
    }));

    return {
      totalTicketsCount: total,
      resolvedTicketsCount: resolved,
      pendingTicketsCount: pending,
      slaBreachedCount: breached,
      averageSatisfactionScore: avgScore,
      satisfactionDistribution: distribution
    };
  }

  async addMessage(userId, input, senderType = 'user') {
    const data = addMessageSchema.parse(input);
    
    // For staff, skip user ID mapping on find
    const where = { id: data.ticketId };
    if (senderType === 'user') {
      where.userId = userId;
    }

    const ticket = await this.models.SupportTicket.findOne({ where });
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
      } else if (senderType === 'staff') {
        ticket.status = 'pending';
      }

      await ticket.save({ transaction: t });
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

  async updateTicketStatus(ticketId, status) {
    const parsedId = z.string().uuid().parse(ticketId);
    const parsedStatus = z.enum(['open', 'pending', 'resolved', 'closed']).parse(status);

    const ticket = await this.models.SupportTicket.findByPk(parsedId);
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = parsedStatus;
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

  async checkSlaEscalations() {
    const unresolvedTickets = await this.models.SupportTicket.findAll({
      where: {
        status: {
          [this.models.Sequelize.Op.notIn]: ['resolved', 'closed']
        },
        slaBreached: false,
        slaExpiresAt: {
          [this.models.Sequelize.Op.lt]: new Date()
        }
      }
    });

    for (const ticket of unresolvedTickets) {
      ticket.slaBreached = true;
      await ticket.save();
    }
    return true;
  }
}
