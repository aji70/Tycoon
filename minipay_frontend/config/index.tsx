import { cookieStorage, createStorage } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { celo } from '@reown/appkit/networks'

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const networks = [celo]

export const defaultNetwork = networks[0]
export const appChain = 'CELO'

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig

/** @deprecated Use `config` or `wagmiAdapter.wagmiConfig` */
export function getWagmiConfig() {
  return wagmiAdapter.wagmiConfig
}
