import { SupportedChains } from '@goodsdks/citizen-sdk';
import type { contractEnv } from '@goodsdks/citizen-sdk';

export const GD_CELO_CHAIN_ID = SupportedChains.CELO;

export const GD_ENV: contractEnv =
  process.env.NEXT_PUBLIC_GD_ENV === 'staging'
    ? 'staging'
    : process.env.NEXT_PUBLIC_GD_ENV === 'development'
      ? 'development'
      : 'production';
