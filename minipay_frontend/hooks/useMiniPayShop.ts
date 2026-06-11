import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient, useWalletClient, useAccount } from 'wagmi'
import { encodeFunctionData, type Address } from 'viem'

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
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
  const { data: walletClient } = useWalletClient()
  const walletRef = useRef(walletClient)
  useEffect(() => { walletRef.current = walletClient }, [walletClient])

  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPayingRef = useRef(false)

  const sendERC20Transfer = useCallback(
    async (tokenAddress: Address, recipientAddress: Address, amount: bigint): Promise<string> => {
      if (!address || isPayingRef.current) throw new Error('Not ready to pay')
      isPayingRef.current = true
      setIsPaying(true)
      setError(null)

      try {
        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [recipientAddress, amount],
        })

        let txHash: string | undefined

        if (isMiniPayBrowser()) {
          // Bypass viem for MiniPay — raw eth_accounts + eth_sendTransaction with explicit gas
          // MiniPay's injected provider rejects viem's prepareTransactionRequest with Celo-specific params
          const accounts: string[] = await (window.ethereum as any).request({
            method: 'eth_accounts',
          })
          txHash = await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{
              from: accounts[0],
              to: tokenAddress,
              data,
              gas: '0x493E0', // 300,000 — sufficient for ERC-20 transfer
            }],
          })
        } else {
          if (!walletRef.current) throw new Error('Wallet not connected')
          txHash = await walletRef.current.sendTransaction({
            to: tokenAddress,
            data,
          })
        }

        if (!txHash) throw new Error('Transaction hash unavailable')

        // Wait for receipt before returning so on-chain state is confirmed
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
    sendERC20Transfer,
  }
}
