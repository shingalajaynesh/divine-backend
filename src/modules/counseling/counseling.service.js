import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(8).max(20),
  source: z.string().max(100).optional()
});

export const scheduleCallSchema = z.object({
  leadId: z.string().uuid(),
  scheduledAt: z.string()
});

export const logCallSchema = z.object({
  callId: z.string().uuid(),
  status: z.enum(['scheduled', 'completed', 'no_show', 'cancelled']),
  durationMinutes: z.number().int().min(0).max(120).optional(),
  outcome: z.string().max(255).optional(),
  notes: z.string().max(2000).optional()
});

export class CounselingService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getLeads(viewer, status, assignedToMe) {
    const where = {};
    if (status) {
      where.status = status;
    }
    if (assignedToMe) {
      where.assignedTo = viewer.id;
    }

    return this.models.CounselingLead.findAll({
      where,
      include: [
        { model: this.models.User, as: 'counselor', attributes: ['displayName', 'email'] },
        { model: this.models.User, as: 'convertedUser', attributes: ['displayName', 'email'] },
        { 
          model: this.models.CounselingCall, 
          as: 'calls',
          include: [{ model: this.models.User, as: 'counselor', attributes: ['displayName'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async getLeadDetails(id) {
    const leadId = z.string().uuid().parse(id);
    return this.models.CounselingLead.findByPk(leadId, {
      include: [
        { model: this.models.User, as: 'counselor', attributes: ['displayName', 'email'] },
        { model: this.models.User, as: 'convertedUser', attributes: ['displayName', 'email'] },
        { 
          model: this.models.CounselingCall, 
          as: 'calls',
          include: [{ model: this.models.User, as: 'counselor', attributes: ['displayName'] }]
        }
      ],
      order: [
        [{ model: this.models.CounselingCall, as: 'calls' }, 'createdAt', 'DESC']
      ]
    });
  }

  async getDashboardStats(viewer) {
    const leads = await this.models.CounselingLead.findAll();

    const total = leads.length;
    const countNew = leads.filter(l => l.status === 'new').length;
    const contacted = leads.filter(l => l.status === 'contacted').length;
    const scheduled = leads.filter(l => l.status === 'scheduled').length;
    const converted = leads.filter(l => l.status === 'converted').length;
    const lost = leads.filter(l => l.status === 'lost').length;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    return {
      totalLeadsCount: total,
      newLeadsCount: countNew,
      contactedLeadsCount: contacted,
      scheduledLeadsCount: scheduled,
      convertedLeadsCount: converted,
      lostLeadsCount: lost,
      conversionRate
    };
  }

  async createLead(input) {
    const data = createLeadSchema.parse(input);
    return this.models.CounselingLead.create({
      name: data.name,
      email: data.email || null,
      phone: data.phone,
      source: data.source || 'web',
      status: 'new'
    });
  }

  async updateLeadStatus(id, status) {
    const leadId = z.string().uuid().parse(id);
    const parsedStatus = z.enum(['new', 'contacted', 'scheduled', 'converted', 'lost']).parse(status);

    const lead = await this.models.CounselingLead.findByPk(leadId);
    if (!lead) throw new Error('Lead not found');

    lead.status = parsedStatus;
    await lead.save();
    return lead;
  }

  async assignLead(id, counselorId) {
    const leadId = z.string().uuid().parse(id);
    const parsedCounselorId = z.string().uuid().parse(counselorId);

    const lead = await this.models.CounselingLead.findByPk(leadId);
    if (!lead) throw new Error('Lead not found');

    lead.assignedTo = parsedCounselorId;
    await lead.save();
    return lead;
  }

  async scheduleCall(leadId, scheduledAt, counselorId) {
    const parsed = scheduleCallSchema.parse({ leadId, scheduledAt });
    const lead = await this.models.CounselingLead.findByPk(parsed.leadId);
    if (!lead) throw new Error('Lead not found');

    return this.sequelize.transaction(async (t) => {
      const call = await this.models.CounselingCall.create({
        leadId: parsed.leadId,
        scheduledAt: new Date(parsed.scheduledAt),
        status: 'scheduled',
        counselorId
      }, { transaction: t });

      // Automatically update lead next follow-up and status if appropriate
      lead.nextFollowUp = new Date(parsed.scheduledAt);
      if (lead.status === 'new' || lead.status === 'contacted') {
        lead.status = 'scheduled';
      }
      await lead.save({ transaction: t });

      return call;
    });
  }

  async logCallOutcome(input, counselorId) {
    const data = logCallSchema.parse(input);
    const call = await this.models.CounselingCall.findByPk(data.callId);
    if (!call) throw new Error('Call not found');

    const lead = await this.models.CounselingLead.findByPk(call.leadId);
    if (!lead) throw new Error('Lead not found');

    return this.sequelize.transaction(async (t) => {
      call.status = data.status;
      if (data.durationMinutes !== undefined) call.durationMinutes = data.durationMinutes;
      if (data.outcome !== undefined) call.outcome = data.outcome;
      if (data.notes !== undefined) call.notes = data.notes;
      await call.save({ transaction: t });

      // If call completed, update lead status
      if (data.status === 'completed' && lead.status === 'scheduled') {
        lead.status = 'contacted';
        lead.nextFollowUp = null;
        await lead.save({ transaction: t });
      }

      return call;
    });
  }

  async convertLeadToMember(leadId, centerId, counselorId) {
    const parsedLeadId = z.string().uuid().parse(leadId);
    const parsedCenterId = z.string().uuid().parse(centerId);

    const lead = await this.models.CounselingLead.findByPk(parsedLeadId);
    if (!lead) throw new Error('Lead not found');
    if (lead.status === 'converted' && lead.convertedUserId) {
      throw new Error('Lead already converted');
    }

    // Retrieve mother role ID
    const motherRole = await this.models.Role.findOne({ where: { roleType: 'MOTHER' } });
    if (!motherRole) throw new Error('Mother role not configured in system');

    return this.sequelize.transaction(async (t) => {
      const email = lead.email || `${lead.phone}@divine.com`;
      
      // Upsert or find user by phone or email
      let user = await this.models.User.findOne({
        where: { mobileNo: lead.phone }
      }, { transaction: t });

      if (!user) {
        user = await this.models.User.create({
          displayName: lead.name,
          emailAddress: email.toLowerCase(),
          mobileNo: lead.phone,
          roleId: motherRole.id,
          centerId: parsedCenterId,
          pregnancyStartDate: new Date()
        }, { transaction: t });
      }

      // Mark lead converted
      lead.status = 'converted';
      lead.convertedUserId = user.id;
      lead.convertedAt = new Date();
      await lead.save({ transaction: t });

      return user;
    });
  }
}
