/**
 * Arena tournaments: visibility (open / invite-only / bot selection), invite token, allowed agent ids.
 */

export const up = async (knex) => {
  await knex.schema.table("tournaments", (table) => {
    table
      .enu("visibility", ["OPEN", "INVITE_ONLY", "BOT_SELECTION"])
      .notNullable()
      .defaultTo("OPEN")
      .index();
    table.string("invite_token", 64).nullable().unique().index();
    table.json("allowed_agent_ids").nullable();
  });
};

export const down = async (knex) => {
  await knex.schema.table("tournaments", (table) => {
    table.dropColumn("visibility");
    table.dropColumn("invite_token");
    table.dropColumn("allowed_agent_ids");
  });
};
