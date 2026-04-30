import { cookieStorage, createStorage, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { celo } from '@reown/appkit/networks'

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Celo only (or Celo/Base in a dedicated frontend)
export const networks = [celo]

/** Backend chain name for this deployment. Derived from default network so each site (Polygon/Celo/Base) sends the right chain. */
function chainIdToBackendChain(chainId: number): 'POLYGON' | 'CELO' | 'BASE' {
  if (chainId === 137 || chainId === 80001) return 'POLYGON'
  if (chainId === 42220 || chainId === 44787) return 'CELO'
  if (chainId === 8453 || chainId === 84531) return 'BASE'
  return 'CELO'
}

export const defaultNetwork = networks[0]
export const appChain = chainIdToBackendChain(defaultNetwork?.id ?? 42220)

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig
