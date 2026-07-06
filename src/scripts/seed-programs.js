const demoPrograms = [{
  slug: 'divine-daily-foundations',
  name: 'Divine Daily Foundations',
  summary: 'A gentle starter journey with original breathing, bonding and reflection practices for pregnancy.',
  language: 'en', journeyStage: 'pregnancy', status: 'published', isPremium: false, sortOrder: 1,
  modules: [
    { title: 'Calm beginnings', description: 'Simple practices for a peaceful daily rhythm.', sortOrder: 1, unlockDay: 1, lessons: [
      { slug: 'arrive-with-your-breath', title: 'Arrive with your breath', summary: 'A comfortable five-minute settling practice.', lessonType: 'practice', durationMins: 5, releaseDay: 1, sortOrder: 1, activities: [
        { slug: 'five-comfortable-breaths', title: 'Five comfortable breaths', instructions: 'Sit in a supported position. Breathe naturally five times without holding or forcing the breath. Stop if you feel uncomfortable.', quotient: 'EQ', activityType: 'practice', estimatedMins: 5, points: 10, sortOrder: 1 },
      ] },
    ] },
    { title: 'Loving connection', description: 'Thoughtful moments for mother, baby and family.', sortOrder: 2, unlockDay: 2, lessons: [
      { slug: 'one-loving-thought', title: 'One loving thought', summary: 'Create a small daily bonding ritual.', lessonType: 'practice', durationMins: 7, releaseDay: 2, sortOrder: 1, activities: [
        { slug: 'share-a-kind-message', title: 'Share a kind message', instructions: 'Choose one kind, hopeful sentence and speak it softly to your baby. Write a short note about how the moment felt.', quotient: 'SQ', activityType: 'reflection', estimatedMins: 7, requiresSubmission: false, points: 10, sortOrder: 1 },
      ] },
    ] },
  ],
}];

export const seedPrograms = async (models, sequelize, log) => sequelize.transaction(async (transaction) => {
  for (const definition of demoPrograms) {
    const { modules, ...programData } = definition;
    const [program] = await models.Program.findOrCreate({ where: { slug: programData.slug }, defaults: programData, transaction });
    await program.update(programData, { transaction });
    for (const moduleDefinition of modules) {
      const { lessons, ...moduleData } = moduleDefinition;
      const [programModule] = await models.ProgramModule.findOrCreate({ where: { programId: program.id, title: moduleData.title }, defaults: { ...moduleData, programId: program.id, isPublished: true }, transaction });
      await programModule.update({ ...moduleData, isPublished: true }, { transaction });
      for (const lessonDefinition of lessons) {
        const { activities, ...lessonData } = lessonDefinition;
        const [lesson] = await models.ProgramLesson.findOrCreate({ where: { moduleId: programModule.id, slug: lessonData.slug }, defaults: { ...lessonData, moduleId: programModule.id, isPublished: true }, transaction });
        await lesson.update({ ...lessonData, isPublished: true }, { transaction });
        for (const activityData of activities) {
          const [activity] = await models.ProgramActivity.findOrCreate({ where: { lessonId: lesson.id, slug: activityData.slug }, defaults: { ...activityData, lessonId: lesson.id, isPublished: true }, transaction });
          await activity.update({ ...activityData, isPublished: true }, { transaction });
        }
      }
    }
  }
  log.info('Divine demo programme seed is current.');
});
