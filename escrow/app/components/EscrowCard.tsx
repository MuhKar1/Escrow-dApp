import { useState, useEffect } from 'react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { useEscrow } from './EscrowContext'
import TimeDisplay from './TimeDisplay'

interface EscrowCardProps {
  escrow: any
  onUpdate?: () => void
}

export default function EscrowCard({ escrow, onUpdate }: EscrowCardProps) {
  const { program, setLoading, setMessage, fetchMakerEscrows, refreshBalance } = useEscrow()
  const { publicKey } = useWallet()
  const [expanded, setExpanded] = useState(false)
  const [localError, setLocalError] = useState<string>('')
  const [localSuccess, setLocalSuccess] = useState<string>('')

  /**
   * Auto-clear Local Success Messages Effect
   *
   * Automatically clears local success messages after 5 seconds
   * to provide better user experience without persistent UI clutter.
   */
  useEffect(() => {
    if (localSuccess) {
      const timer = setTimeout(() => {
        setLocalSuccess('')
      }, 5000) // Clear after 5 seconds

      return () => clearTimeout(timer)
    }
  }, [localSuccess])

  const now = Date.now() / 1000
  const isExpired = now >= escrow.expiryTs
  const isMaker = escrow.maker.equals(publicKey)
  const isTaker = escrow.taker?.equals(publicKey)
  const canFund = !escrow.isFunded && !isExpired && isTaker
  const canComplete = escrow.isFunded && !escrow.isCompleted && isTaker
  const canCancel = !escrow.isFunded && !isExpired && isMaker
  const canRefund = isExpired && !escrow.isCompleted && isMaker

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  // Helper function to parse errors into user-friendly messages
  const parseError = (error: any, action: string): string => {
    if (!error || !error.message) return `${action} failed`

    const errorMsg = typeof error.message === 'string' ? error.message.toLowerCase() : String(error.message).toLowerCase()

    if (errorMsg.includes('insufficient funds')) {
      return 'Insufficient SOL balance for this transaction.'
    } else if (errorMsg.includes('already in use')) {
      return 'This escrow is already in use or has been modified.'
    } else if (errorMsg.includes('invalid public key')) {
      return 'Invalid wallet address detected.'
    } else if (errorMsg.includes('only taker can call this') || errorMsg.includes('unauthorized')) {
      return 'Only the taker can complete this swap. The taker is the person who funded the escrow.'
    } else if (errorMsg.includes('escrow is not active') || errorMsg.includes('not active')) {
      return 'This escrow must be funded first before it can be completed. The taker needs to fund the escrow.'
    } else if (errorMsg.includes('custom program error')) {
      return `${action} failed due to program constraints.`
    } else if (errorMsg.includes('blockhash not found') || errorMsg.includes('failed to get recent blockhash') || errorMsg.includes('networkerror')) {
      return 'Network error: Unable to reach the Solana RPC endpoint. Check your internet connection or RPC configuration and try again.'
    } else if (errorMsg.includes('simulation failed')) {
      return `${action} simulation failed. Please check your connection and try again.`
    } else if (errorMsg.includes('timeout')) {
      return 'Transaction timed out. Please try again.'
    } else {
      return `${action} failed: ${typeof error.message === 'string' ? error.message : String(error.message)}`
    }
  }

  const getStatusColor = () => {
    if (escrow.isCompleted) return 'bg-green-900 border-green-500'
    if (isExpired) return 'bg-red-900 border-red-500'
    if (escrow.isFunded) return 'bg-blue-900 border-blue-500'
    return 'bg-yellow-900 border-yellow-500'
  }

  const getStatusText = () => {
    if (escrow.isCompleted) return 'Completed'
    if (isExpired) return 'Expired'
    if (escrow.isFunded) return 'Funded - Ready to Complete'
    return 'Waiting for Taker'
  }

  const fundEscrow = async () => {
    if (!program || !publicKey) return

    console.log('=== Fund Escrow Debug ===')
    console.log('Your wallet:', publicKey.toBase58())
    console.log('Taker pubkey in escrow:', escrow.taker?.toBase58 ? escrow.taker.toBase58() : 'undefined')
    console.log('Are they equal?', escrow.taker?.equals ? escrow.taker.equals(publicKey) : 'cannot compare')

    // Check if this is the authorized taker
    if (!escrow.taker?.equals || !escrow.taker.equals(publicKey)) {
      setMessage('Error: You are not the authorized taker for this escrow. Expected: ' + (escrow.taker?.toBase58 ? escrow.taker.toBase58() : 'N/A'))
      return
    }

    // Check if escrow has expired
    if (isExpired) {
      setMessage('Error: This escrow has expired and cannot be funded')
      return
    }

    setLoading(true)
    setMessage('')
    setLocalError('')
    setLocalSuccess('')

    try {
      const tx = await program.methods
        .fundEscrow()
        .accounts({
          escrow: escrow.escrowPda,
          taker: publicKey,
          maker: escrow.maker,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false })

      // Wait for confirmation
      const connection = program.provider.connection
      const latestBlockhash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        signature: tx,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')

      setMessage(`Escrow funded successfully! TX: ${tx}`)
      setLocalSuccess(`Escrow funded successfully!`)
      console.log('Transaction signature:', tx)

      // Clear loading immediately after transaction confirmation
      setLoading(false)

      // Refresh balance and data in background without blocking UI
      refreshBalance()
      fetchMakerEscrows(false).then(() => onUpdate?.()).catch(console.error)
    } catch (error: any) {
      console.error('Fund escrow error:', error)
      setLocalError(parseError(error, 'Funding escrow'))
      setLoading(false)
    }
  }

  const completeSwap = async () => {
    if (!program || !publicKey) return

    setLoading(true)
    setMessage('')
    setLocalError('')
    setLocalSuccess('')

    try {
      const tx = await program.methods
        .completeSwap()
        .accounts({
          escrow: escrow.escrowPda,
          taker: publicKey,
          maker: escrow.maker,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false })

      // Wait for confirmation
      const connection = program.provider.connection
      const latestBlockhash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        signature: tx,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')

      setMessage(`Swap completed successfully! TX: ${tx}`)
      setLocalSuccess(`Swap completed successfully!`)
      console.log('Transaction signature:', tx)

      // Clear loading immediately after transaction confirmation
      setLoading(false)

      // Refresh balance and data in background without blocking UI
      refreshBalance()
      fetchMakerEscrows(false).then(() => onUpdate?.()).catch(console.error)
    } catch (error: any) {
      console.error('Complete swap error:', error)
      setLocalError(parseError(error, 'Completing swap'))
      setLoading(false)
    }
  }

  const cancelEscrow = async () => {
    if (!program || !publicKey) return

    setLoading(true)
    setMessage('')
    setLocalError('')
    setLocalSuccess('')

    try {
      const tx = await program.methods
        .cancelEscrow()
        .accounts({
          escrow: escrow.escrowPda,
          maker: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false })

      // Wait for confirmation
      const connection = program.provider.connection
      const latestBlockhash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        signature: tx,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')

      setMessage(`Escrow cancelled successfully! TX: ${tx}`)
      setLocalSuccess(`Escrow cancelled successfully!`)
      console.log('Transaction signature:', tx)

      // Clear loading immediately after transaction confirmation
      setLoading(false)

      // Refresh balance and data in background without blocking UI
      refreshBalance()
      fetchMakerEscrows(false).then(() => onUpdate?.()).catch(console.error)
    } catch (error: any) {
      console.error('Cancel escrow error:', error)
      setLocalError(parseError(error, 'Cancelling escrow'))
      setLoading(false)
    }
  }

  const refundAfterExpiry = async () => {
    if (!program || !publicKey) return

    setLoading(true)
    setMessage('')
    setLocalError('')
    setLocalSuccess('')

    try {
      const tx = await program.methods
        .refundAfterExpiry()
        .accounts({
          escrow: escrow.escrowPda,
          maker: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false })

      // Wait for confirmation
      const connection = program.provider.connection
      const latestBlockhash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        signature: tx,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')

      setMessage(`Refund processed successfully! TX: ${tx}`)
      setLocalSuccess(`Refund processed successfully!`)
      console.log('Transaction signature:', tx)

      // Clear loading immediately after transaction confirmation
      setLoading(false)

      // Refresh balance and data in background without blocking UI
      refreshBalance()
      fetchMakerEscrows(false).then(() => onUpdate?.()).catch(console.error)
    } catch (error: any) {
      console.error('Refund error:', error)
      setLocalError(parseError(error, 'Processing refund'))
      setLoading(false)
    }
  }

  return (
    <div className={`border-l-4 p-4 rounded-lg ${getStatusColor()}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-bold text-white">
            Escrow #{typeof escrow.escrowId === 'number' ? escrow.escrowId : escrow.escrowId?.toNumber?.() || 'N/A'}
          </h3>
          <p className="text-sm text-gray-300">{getStatusText()}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-600"
        >
          {expanded ? 'Collapse' : 'Details'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-300">You offer:</p>
          <p className="font-semibold text-white">
            {((typeof escrow.amountA === 'number' ? escrow.amountA : escrow.amountA?.toNumber?.() || 0) / 1e9).toFixed(4)} SOL
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-300">You expect:</p>
          <p className="font-semibold text-white">
            {((typeof escrow.amountBExpected === 'number' ? escrow.amountBExpected : escrow.amountBExpected?.toNumber?.() || 0) / 1e9).toFixed(4)} SOL
          </p>
        </div>
      </div>

      {expanded && (
        <div className="mb-4 space-y-2">
          <div>
            <p className="text-sm text-gray-300">Maker:</p>
            <p className="font-mono text-sm text-white">{truncateAddress(escrow.maker.toBase58())}</p>
          </div>
          {escrow.taker && (
            <div>
              <p className="text-sm text-gray-300">Taker:</p>
              <p className="font-mono text-sm text-white">{truncateAddress(escrow.taker.toBase58())}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-300">Expires:</p>
            <TimeDisplay timestamp={escrow.expiryTs} />
          </div>
          <div>
            <p className="text-sm text-gray-300">PDA:</p>
            <p className="font-mono text-sm text-white break-all">{truncateAddress(escrow.escrowPda.toBase58())}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canFund && (
          <button
            onClick={fundEscrow}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Fund Escrow
          </button>
        )}
        {canComplete && (
          <button
            onClick={completeSwap}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Complete Swap
          </button>
        )}
        {canCancel && (
          <button
            onClick={cancelEscrow}
            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
          >
            Cancel
          </button>
        )}
        {canRefund && (
          <button
            onClick={refundAfterExpiry}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Refund
          </button>
        )}
      </div>

      {localError && (
        <div className="mt-3 p-3 bg-red-900 border border-red-500 rounded text-red-200 text-sm">
          {localError}
        </div>
      )}

      {localSuccess && (
        <div className="mt-3 p-3 bg-green-900 border border-green-500 rounded text-green-200 text-sm">
          {localSuccess}
        </div>
      )}
    </div>
  )
}