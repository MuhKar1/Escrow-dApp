import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useEffect, useState, useCallback } from 'react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useEscrow } from './EscrowContext'

interface BalanceDisplayProps {
  className?: string
}

export default function BalanceDisplay({ className = '' }: BalanceDisplayProps) {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const { balanceRefreshTrigger } = useEscrow()
  const [balance, setBalance] = useState<number | null>(null)

  const refreshBalance = useCallback(async () => {
    if (connected && publicKey) {
      try {
        const balanceLamports = await connection.getBalance(publicKey)
        setBalance(balanceLamports / LAMPORTS_PER_SOL)
      } catch (error) {
        console.error('Error fetching balance:', error)
        setBalance(null)
      }
    } else {
      setBalance(null)
    }
  }, [connected, publicKey, connection])

  useEffect(() => {
    refreshBalance()
  }, [connected, publicKey, connection, refreshBalance, balanceRefreshTrigger])

  if (!connected || !publicKey) {
    return null
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <div className={`bg-gray-800 p-4 rounded-lg ${className}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-semibold text-white">Wallet Balance</h3>
          <p className="text-sm text-gray-400 font-mono">{truncateAddress(publicKey.toBase58())}</p>
        </div>
        <button
          onClick={refreshBalance}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
      <div className="text-2xl font-bold text-green-400">
        {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
      </div>
    </div>
  )
}