import { z } from 'zod';

export const submitQuizInputSchema = z.object({
  dayNumber: z.number().int().min(1).max(280),
  selectedOptionIndex: z.number().int().min(0).max(3)
});

export class QuizService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getDailyQuiz(dayNumber, language = 'en') {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    const quiz = await this.models.QuizQuestion.findOne({
      where: { dayNumber: parsedDay }
    });

    if (!quiz) {
      return null;
    }

    const isHi = language === 'hi';
    return {
      id: quiz.id,
      dayNumber: quiz.dayNumber,
      questionText: isHi ? quiz.questionTextHi : quiz.questionTextEn,
      options: isHi ? quiz.optionsHi : quiz.optionsEn,
      correctOptionIndex: quiz.correctOptionIndex,
      explanation: isHi ? quiz.explanationHi : quiz.explanationEn
    };
  }

  async getMyQuizAttempt(userId, dayNumber) {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    return this.models.QuizAttempt.findOne({
      where: { userId, dayNumber: parsedDay }
    });
  }

  async submitQuizAnswer(userId, dayNumber, selectedOptionIndex, userPregnancyDay) {
    const validated = submitQuizInputSchema.parse({ dayNumber, selectedOptionIndex });
    
    // Catch-up validation: cannot submit answers for future days
    if (validated.dayNumber > userPregnancyDay) {
      throw new Error(`Cannot submit quiz answers for future days. Current day is ${userPregnancyDay}.`);
    }

    const quiz = await this.models.QuizQuestion.findOne({
      where: { dayNumber: validated.dayNumber }
    });

    if (!quiz) {
      throw new Error(`No quiz question available for Day ${validated.dayNumber}.`);
    }

    return this.sequelize.transaction(async (transaction) => {
      let attempt = await this.models.QuizAttempt.findOne({
        where: { userId, dayNumber: validated.dayNumber },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (attempt) {
        throw new Error('This quiz has already been attempted.');
      }

      attempt = await this.models.QuizAttempt.create({
        userId,
        quizQuestionId: quiz.id,
        dayNumber: validated.dayNumber,
        selectedOptionIndex: validated.selectedOptionIndex,
        isCorrect: validated.selectedOptionIndex === quiz.correctOptionIndex,
        attemptedAt: new Date()
      }, { transaction });

      return attempt;
    });
  }
}
