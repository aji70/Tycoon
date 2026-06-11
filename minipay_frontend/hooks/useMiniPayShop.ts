import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient, useWalletClient, useAccount } from 'wagmi'
import { encodeFunctionData, type Address } from 'viem'

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

async function sendRawTransaction(tokenAddress: Address, data: string, gas: string = '0x493E0'): Promise<string> {
  const accounts: string[] = await (window.ethereum as any).request({
    method: 'eth_accounts',
  })
  const txHash = await (window.ethereum as any).request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to: tokenAddress,
      data,
      gas,
    }],
  })
  if (!txHash) throw new Error('Transaction hash unavailable')
  return txHash
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

  const approveAndTransfer = useCallback(
    async (tokenAddress: Address, spenderAddress: Address, amount: bigint): Promise<string> => {
      if (!address || isPayingRef.current) throw new Error('Not ready to pay')
      isPayingRef.current = true
      setIsPaying(true)
      setError(null)

      try {
        if (isMiniPayBrowser()) {
          // Step 1: Approve the spender to use the tokens
          const approveData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [spenderAddress, amount],
          })
          const approveTx = await sendRawTransaction(tokenAddress, approveData)

          // Wait for approval to be confirmed
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: approveTx as `0x${string}` })
          }

          // Step 2: Transfer the tokens
          const transferData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [spenderAddress, amount],
          })
          const txHash = await sendRawTransaction(tokenAddress, transferData)

          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
          }

          return txHash
        } else {
          if (!walletRef.current) throw new Error('Wallet not connected')

          // For non-MiniPay, just do a transfer
          const transferData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [spenderAddress, amount],
          })
          const txHash = await walletRef.current.sendTransaction({
            to: tokenAddress,
            data: transferData,
          })

          if (!txHash) throw new Error('Transaction hash unavailable')

          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
          }

          return txHash
        }
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
    approveAndTransfer,
  }
}
