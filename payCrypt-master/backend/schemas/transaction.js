import Joi from "joi";

export const transactionSchema = Joi.object({
  user_id: Joi.any().allow("", null),
  wallet_id: Joi.any().allow("", null),
  reference: Joi.any().allow("", null),
  type: Joi.any().allow("", null),
  action: Joi.any().allow("", null),
  amount: Joi.any().allow("", null),
  balance_before: Joi.any().allow("", null),
  balance_after: Joi.any().allow("", null),
  status: Joi.any().allow("", null),
  hash: Joi.any().allow("", null),
  token: Joi.any().allow("", null),
  rate: Joi.any().allow("", null),
  description: Joi.any().allow("", null),
  extra: Joi.any().allow("", null),
  created_at: Joi.any().allow("", null),
  updated_at: Joi.any().allow("", null),
});
