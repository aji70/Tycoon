import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient, useAccount } from 'wagmi'
import { createWalletClient, custom, encodeFunctionData, type Address, type Abi } from 'viem'
import { celo } from 'viem/chains'

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

export function isMiniPayBrowser(): boolean {
  try {
    return (window as any).ethereum?.isMiniPay === true
  } catch {
    return false
  }
}

export function useMiniPayShop() {
  const { address } = useAccount()
  const publicClient = usePublicClient()

  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPayingRef = useRef(false)

  const sendRawApproval = useCallback(
    async (tokenAddress: Address, spenderAddress: Address, amount: bigint): Promise<string> => {
      if (!address || isPayingRef.current) throw new Error('Not ready to pay')
      isPayingRef.current = true
      setIsPaying(true)
      setError(null)

      try {
        // Use viem's createWalletClient with MiniPay provider
        // This properly handles fee abstraction and legacy transactions
        const walletClient = createWalletClient({
          chain: celo,
          transport: custom(window.ethereum!),
        })

        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [spenderAddress, amount],
        })

        // Use viem's sendTransaction which handles Celo fee abstraction
        const txHash = await walletClient.sendTransaction({
          account: address,
          to: tokenAddress,
          data: approveData,
          feeCurrency: tokenAddress, // Pay gas in the same stablecoin being approved
        })

        if (!txHash) throw new Error('Approval transaction failed')

        // Wait for receipt
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
        }

        return txHash
      } catch (err: any) {
        const msg =
          err?.message ||
          err?.data?.message ||
          (typeof err === 'string' ? err : 'Approval failed')
        setError(msg.length > 100 ? msg.slice(0, 100) + '…' : msg)
        throw err
      } finally {
        isPayingRef.current = false
        setIsPaying(false)
      }
    },
    [address, publicClient]
  )

  const sendContractCallRaw = useCallback(
    async (
      contractAddress: Address,
      functionData: string, // Pre-encoded function call
      feeCurrency: Address
    ): Promise<string> => {
      if (!address || isPayingRef.current) throw new Error('Not ready to pay')
      isPayingRef.current = true
      setIsPaying(true)
      setError(null)

      try {
        // Use raw eth_sendTransaction with feeCurrency for adapter support
        // This avoids viem's eth_estimateGas which MiniPay rejects
        const accounts: string[] = await (window.ethereum as any).request({
          method: 'eth_accounts',
        })

        const txHash = await (window.ethereum as any).request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: contractAddress,
            data: functionData,
            feeCurrency, // MiniPay adapter address for fee abstraction
          }],
        })

        if (!txHash) throw new Error('Contract call failed')

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
        }

        return txHash
      } catch (err: any) {
        const msg =
          err?.message ||
          err?.data?.message ||
          (typeof err === 'string' ? err : 'Transaction failed')
        setError(msg.length > 100 ? msg.slice(0, 100) + '…' : msg)
        throw err
      } finally {
        isPayingRef.current = false
        setIsPaying(false)
      }
    },
    [address, publicClient]
  )

  return {
    isPaying,
    error,
    sendRawApproval,
    sendContractCallRaw,
  }
}
