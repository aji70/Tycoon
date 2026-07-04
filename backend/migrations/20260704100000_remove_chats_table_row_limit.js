/**
 * Railway/MySQL: chats can hit "The table 'chats' is full" at ~2000 rows when
 * MAX_ROWS is set (common on MyISAM). Remove the cap and use InnoDB.
 */
export async function up(knex) {
  const client = knex.client.config.client;
  if (client !== "mysql" && client !== "mysql2") return;

  for (const table of ["chats", "messages"]) {
    if (!(await knex.schema.hasTable(table))) continue;
    await knex.raw("ALTER TABLE ?? ENGINE=InnoDB ROW_FORMAT=DYNAMIC MAX_ROWS=0", [table]);
  }
}

export async function down(knex) {
  // No safe rollback — previous engine/limits are unknown.
}
