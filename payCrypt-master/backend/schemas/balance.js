import Joi from "joi";

export const balanceSchema = Joi.object({
  user_id: Joi.any().allow("", null),
  token: Joi.any().allow("", null),
  symbol: Joi.any().allow("", null),
  chain: Joi.any().allow("", null),
  amount: Joi.any().allow("", null),
  usd_value: Joi.any().allow("", null),
  tag: Joi.any().allow("", null),
  address: Joi.any().allow("", null),
  auto_convert_threshold: Joi.any().allow("", null),
});
