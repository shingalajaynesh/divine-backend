import { v4 as uuidv4 } from 'uuid';

export class SpecialEventService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getSpecialEvents(viewer, eventType) {
    const where = {};
    if (eventType) {
      where.eventType = eventType;
    }
    return this.models.SpecialEvent.findAll({
      where,
      order: [['eventDate', 'ASC']]
    });
  }

  async createSpecialEvent(viewer, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const { title, description, eventType, eventDate, durationMinutes, speakerName, location, maxRegistrations } = input;

    if (!title || !title.trim()) throw new Error('Title is required');
    if (!description || !description.trim()) throw new Error('Description is required');
    if (!eventType) throw new Error('Event type is required');
    if (!eventDate) throw new Error('Event date is required');
    if (!durationMinutes || durationMinutes <= 0) throw new Error('Duration must be greater than 0');

    return this.models.SpecialEvent.create({
      id: uuidv4(),
      title: title.trim(),
      description: description.trim(),
      eventType,
      eventDate: new Date(eventDate),
      durationMinutes,
      speakerName: speakerName?.trim() || null,
      location: location?.trim() || null,
      maxRegistrations: maxRegistrations || null
    });
  }

  async updateSpecialEvent(viewer, id, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const event = await this.models.SpecialEvent.findByPk(id);
    if (!event) throw new Error('Event not found');

    const allowedUpdates = {};
    if (input.title !== undefined) allowedUpdates.title = input.title;
    if (input.description !== undefined) allowedUpdates.description = input.description;
    if (input.eventType !== undefined) allowedUpdates.eventType = input.eventType;
    if (input.eventDate !== undefined) allowedUpdates.eventDate = new Date(input.eventDate);
    if (input.durationMinutes !== undefined) allowedUpdates.durationMinutes = input.durationMinutes;
    if (input.speakerName !== undefined) allowedUpdates.speakerName = input.speakerName;
    if (input.location !== undefined) allowedUpdates.location = input.location;
    if (input.maxRegistrations !== undefined) allowedUpdates.maxRegistrations = input.maxRegistrations;
    if (input.replayUrl !== undefined) allowedUpdates.replayUrl = input.replayUrl;

    return event.update(allowedUpdates);
  }

  async deleteSpecialEvent(viewer, id) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const event = await this.models.SpecialEvent.findByPk(id);
    if (!event) throw new Error('Event not found');

    await event.destroy();
    return true;
  }

  async registerForEvent(viewer, eventId) {
    if (!viewer || !viewer.id) throw new Error('Authentication required');

    const event = await this.models.SpecialEvent.findByPk(eventId);
    if (!event) throw new Error('Event not found');

    // Check capacity limit
    if (event.maxRegistrations) {
      const regCount = await this.models.EventRegistration.count({ where: { eventId } });
      if (regCount >= event.maxRegistrations) {
        throw new Error('Event capacity has been fully reached');
      }
    }

    // Check duplicate registration
    const existing = await this.models.EventRegistration.findOne({
      where: { eventId, userId: viewer.id }
    });
    if (existing) {
      throw new Error('You are already registered for this event');
    }

    return this.models.EventRegistration.create({
      id: uuidv4(),
      eventId,
      userId: viewer.id,
      registeredAt: new Date(),
      checkedIn: false
    });
  }

  async checkInToEvent(viewer, registrationId) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const reg = await this.models.EventRegistration.findByPk(registrationId);
    if (!reg) throw new Error('Registration record not found');

    return reg.update({
      checkedIn: true,
      checkedInAt: new Date()
    });
  }

  async submitEventFeedback(viewer, eventId, rating, feedbackText) {
    if (!viewer || !viewer.id) throw new Error('Authentication required');
    if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

    const reg = await this.models.EventRegistration.findOne({
      where: { eventId, userId: viewer.id }
    });

    if (!reg) throw new Error('No registration found for this event');
    if (!reg.checkedIn) throw new Error('Feedback is only allowed after checking in or attending');

    return reg.update({
      feedbackRating: rating,
      feedbackText: feedbackText || null
    });
  }

  async getEventAttendees(viewer, eventId) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    return this.models.EventRegistration.findAll({
      where: { eventId },
      include: [
        {
          model: this.models.User,
          as: 'user',
          attributes: ['id', 'displayName', 'emailAddress', 'mobileNo']
        }
      ],
      order: [['registeredAt', 'DESC']]
    });
  }
}
