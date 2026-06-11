import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient, useAccount } from 'wagmi'
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
        // MiniPay requires legacy transactions (Type 0) with explicit gas
        // Encode the approve function call
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [spenderAddress, amount],
        })

        // Get account from MiniPay provider
        const accounts: string[] = await (window.ethereum as any).request({
          method: 'eth_accounts',
        })

        // Send legacy transaction with explicit gas (avoid EIP-1559 estimation)
        // 100,000 gas should be sufficient for ERC-20 approval on Celo
        const txHash = await (window.ethereum as any).request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: tokenAddress,
            data: approveData,
            gas: '0x186A0', // 100,000 gas — sufficient for approval
            gasPrice: '0x0', // MiniPay handles gas price; 0 triggers fee abstraction
          }],
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

  return {
    isPaying,
    error,
    sendRawApproval,
  }
}
