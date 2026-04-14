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
  // Index for timedGameFinishPoller: WHERE status IN (...) AND duration IS NOT NULL
  await knex.schema.table('games', (table) => {
    table.index(['status', 'duration'], 'idx_games_status_duration_polling');
  });

  // Index for sorting/filtering by started_at
  await knex.schema.table('games', (table) => {
    table.index(['started_at', 'status'], 'idx_games_started_at_status');
  });

  // Index for agentGameRunner: WHERE status IN (...) queries
  await knex.schema.table('games', (table) => {
    table.index(['status'], 'idx_games_status');
  });

  // Index for created_at filtering in analytics queries
  await knex.schema.table('games', (table) => {
    table.index(['created_at'], 'idx_games_created_at');
  });

  console.log('✓ Added polling optimization indexes (4 new indexes on games table)');
}

export async function down(knex) {
  // Drop indexes in reverse order
  await knex.schema.table('games', (table) => {
    table.dropIndex([], 'idx_games_created_at');
  });

  await knex.schema.table('games', (table) => {
    table.dropIndex([], 'idx_games_status');
  });

  await knex.schema.table('games', (table) => {
    table.dropIndex([], 'idx_games_started_at_status');
  });

  await knex.schema.table('games', (table) => {
    table.dropIndex([], 'idx_games_status_duration_polling');
  });

  console.log('✓ Dropped polling optimization indexes');
}
