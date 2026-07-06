'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create diet_preferences table
    await queryInterface.createTable('diet_preferences', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      diet_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'VEG'
      },
      allergens: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // 2. Create user_meal_plans table
    await queryInterface.createTable('user_meal_plans', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true
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
      meal_type: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      content_item_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'content_items',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      custom_meal_name: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // 3. Create shopping_list_items table
    await queryInterface.createTable('shopping_list_items', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true
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
      ingredient_name: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      quantity: {
        type: Sequelize.STRING(60),
        allowNull: true
      },
      purchased: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Indexes
    await queryInterface.addIndex('user_meal_plans', ['user_id', 'day_number']);
    await queryInterface.addIndex('shopping_list_items', ['user_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('shopping_list_items');
    await queryInterface.dropTable('user_meal_plans');
    await queryInterface.dropTable('diet_preferences');
  }
};
