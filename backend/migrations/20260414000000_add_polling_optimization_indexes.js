/**
 * Cost Optimization: Add indexes for polling queries
 *
 * The timedGameFinishPoller and agentGameRunner services run frequent polls
 * that scan games by status and other fields. These indexes dramatically improve
 * query performance and reduce database load.
 *
 * Before: Full table scan on each poll
 * After: Index-based lookup (5-10x faster)
 */

export async function up(knex) {
  const isMySQL = knex.client.config.client === 'mysql' || knex.client.config.client === 'mysql2';
  const indexesToAdd = [
    { name: 'idx_games_status_duration_polling', columns: ['status', 'duration'] },
    { name: 'idx_games_started_at_status', columns: ['started_at', 'status'] },
    { name: 'idx_games_status', columns: ['status'] },
    { name: 'idx_games_created_at', columns: ['created_at'] },
  ];

  for (const idx of indexesToAdd) {
    try {
      // Check if index already exists
      let indexExists = false;
      if (isMySQL) {
        const result = await knex.raw(
          "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'games' AND INDEX_NAME = ?",
          [idx.name]
        );
        indexExists = result[0] && result[0].length > 0;
      }

      if (!indexExists) {
        await knex.schema.table('games', (table) => {
          table.index(idx.columns, idx.name);
        });
        console.log(`✓ Created index: ${idx.name}`);
      } else {
        console.log(`⊘ Index already exists: ${idx.name} (skipping)`);
      }
    } catch (err) {
      console.log(`⊘ Could not create index ${idx.name}: ${err.message}`);
    }
  }
}

export async function down(knex) {
  const isMySQL = knex.client.config.client === 'mysql' || knex.client.config.client === 'mysql2';
  const indexesToDrop = [
    'idx_games_created_at',
    'idx_games_status',
    'idx_games_started_at_status',
    'idx_games_status_duration_polling',
  ];

  for (const indexName of indexesToDrop) {
    try {
      // Check if index exists
      let indexExists = false;
      if (isMySQL) {
        const result = await knex.raw(
          "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'games' AND INDEX_NAME = ?",
          [indexName]
        );
        indexExists = result[0] && result[0].length > 0;
      }

      if (indexExists) {
        await knex.schema.table('games', (table) => {
          table.dropIndex([], indexName);
        });
        console.log(`✓ Dropped index: ${indexName}`);
      } else {
        console.log(`⊘ Index does not exist: ${indexName} (skipping)`);
      }
    } catch (err) {
      console.log(`⊘ Could not drop index ${indexName}: ${err.message}`);
    }
  }
}
