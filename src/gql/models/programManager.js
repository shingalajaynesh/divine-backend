import { GraphQLError } from 'graphql';
import { Op } from 'sequelize';
import { BaseManager } from './baseManager.js';

const progressStatuses = new Set(['not_started', 'in_progress', 'completed', 'skipped']);

export class ProgramManager extends BaseManager {
  publishedHierarchy() {
    const { ProgramModule, ProgramLesson, ProgramActivity } = this.models;
    return [{
      model: ProgramModule,
      as: 'modules',
      where: { isPublished: true },
      required: false,
      separate: true,
      order: [['sortOrder', 'ASC']],
      include: [{
        model: ProgramLesson,
        as: 'lessons',
        where: { isPublished: true },
        required: false,
        separate: true,
        order: [['sortOrder', 'ASC']],
        include: [{ model: ProgramActivity, as: 'activities', where: { isPublished: true }, required: false, separate: true, order: [['sortOrder', 'ASC']] }],
      }],
    }];
  }

  async getCatalog() {
    return this.models.Program.findAll({
      where: {
        status: 'published',
        [Op.or]: [{ centerId: null }, ...(this.viewer.centerId ? [{ centerId: this.viewer.centerId }] : [])],
      },
      include: this.publishedHierarchy(),
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });
  }

  async getMyEnrollments() {
    return this.models.ProgramEnrollment.findAll({
      where: { userId: this.viewer.id },
      include: [
        { model: this.models.Program, as: 'program', include: this.publishedHierarchy() },
        { model: this.models.ActivityProgress, as: 'activityProgress', include: [{ model: this.models.ProgramActivity, as: 'activity' }] },
      ],
      order: [['enrolledAt', 'DESC']],
    });
  }

  async enroll(programId) {
    const program = await this.models.Program.findOne({
      where: {
        id: programId,
        status: 'published',
        [Op.or]: [{ centerId: null }, ...(this.viewer.centerId ? [{ centerId: this.viewer.centerId }] : [])],
      },
    });
    if (!program) throw new GraphQLError('Programme not found.', { extensions: { code: 'NOT_FOUND' } });
    if (program.isPremium) throw new GraphQLError('This programme requires an entitlement.', { extensions: { code: 'FORBIDDEN' } });

    const [enrollment] = await this.models.ProgramEnrollment.findOrCreate({
      where: { userId: this.viewer.id, programId: program.id },
      defaults: { status: 'active', source: 'self_service', startedAt: new Date() },
    });
    return enrollment.reload({ include: [{ model: this.models.Program, as: 'program' }, { model: this.models.ActivityProgress, as: 'activityProgress' }] });
  }

  async updateProgress(activityId, input) {
    if (input.status && !progressStatuses.has(input.status)) {
      throw new GraphQLError('Unsupported progress status.', { extensions: { code: 'BAD_USER_INPUT' } });
    }
    const activity = await this.models.ProgramActivity.findByPk(activityId, {
      include: [{ model: this.models.ProgramLesson, as: 'lesson', include: [{ model: this.models.ProgramModule, as: 'module' }] }],
    });
    if (!activity?.lesson?.module?.programId || !activity.isPublished) {
      throw new GraphQLError('Activity not found.', { extensions: { code: 'NOT_FOUND' } });
    }
    const now = new Date();
    const enrollment = await this.models.ProgramEnrollment.findOne({
      where: {
        userId: this.viewer.id,
        programId: activity.lesson.module.programId,
        status: 'active',
        [Op.and]: [
          { [Op.or]: [{ accessStartsAt: null }, { accessStartsAt: { [Op.lte]: now } }] },
          { [Op.or]: [{ accessEndsAt: null }, { accessEndsAt: { [Op.gt]: now } }] },
        ],
      },
    });
    if (!enrollment) throw new GraphQLError('Active programme enrollment required.', { extensions: { code: 'FORBIDDEN' } });

    const status = input.status || 'in_progress';
    const [progress] = await this.models.ActivityProgress.findOrCreate({
      where: { enrollmentId: enrollment.id, activityId: activity.id },
      defaults: { userId: this.viewer.id, status: 'not_started' },
    });
    await progress.update({
      ...input,
      status,
      startedAt: progress.startedAt || (status !== 'not_started' ? now : null),
      completedAt: status === 'completed' ? (progress.completedAt || now) : null,
    });
    return progress;
  }
}
