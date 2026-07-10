/**
 * Direct messages between two users.
 */
export const up = async (knex) => {
  const hasConversations = await knex.schema.hasTable("dm_conversations");
  if (!hasConversations) {
    await knex.schema.createTable("dm_conversations", (table) => {
      table.increments("id").primary();
      table.integer("user_low_id").unsigned().notNullable().index();
      table.integer("user_high_id").unsigned().notNullable().index();
      table.timestamp("last_message_at").nullable().index();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
      table.unique(["user_low_id", "user_high_id"]);
    });
  }

  const hasMessages = await knex.schema.hasTable("dm_messages");
  if (!hasMessages) {
    await knex.schema.createTable("dm_messages", (table) => {
      table.increments("id").primary();
      table.integer("conversation_id").unsigned().notNullable().index();
      table.integer("sender_id").unsigned().notNullable().index();
      table.string("body", 1000).notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("dm_messages");
  await knex.schema.dropTableIfExists("dm_conversations");
};
