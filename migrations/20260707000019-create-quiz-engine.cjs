'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const stamps = {
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    };

    // 1. Create quiz_questions table
    await queryInterface.createTable('quiz_questions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      day_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true
      },
      question_text_en: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      question_text_hi: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      options_en: {
        type: Sequelize.JSON,
        allowNull: false
      },
      options_hi: {
        type: Sequelize.JSON,
        allowNull: false
      },
      correct_option_index: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      explanation_en: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      explanation_hi: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      ...stamps
    });

    // 2. Create quiz_attempts table
    await queryInterface.createTable('quiz_attempts', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      day_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      selected_option_index: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      is_correct: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      attempted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      ...stamps
    });

    // Unique index on user attempts for a specific day
    await queryInterface.addIndex('quiz_attempts', ['user_id', 'day_number'], {
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('quiz_attempts');
    await queryInterface.dropTable('quiz_questions');
  }
};
