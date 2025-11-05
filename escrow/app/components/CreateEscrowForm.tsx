import { useState, useEffect } from 'react'
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { useWallet } from '@solana/wallet-adapter-react'
import { useEscrow } from './EscrowContext'

export default function CreateEscrowForm() {
  const { program, setLoading, setMessage, fetchMakerEscrows, refreshBalance } = useEscrow()
  const { publicKey } = useWallet()

  // Form states
  const [escrowId, setEscrowId] = useState('')
  const [amountA, setAmountA] = useState('')
  const [amountBExpected, setAmountBExpected] = useState('')
  const [expiryTime, setExpiryTime] = useState('')
  const [takerPubkey, setTakerPubkey] = useState('')
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

  const createEscrow = async () => {
    if (!program || !publicKey) return

    // Validation
    const id = parseInt(escrowId)
    const aAmount = parseFloat(amountA)
    const bAmount = parseFloat(amountBExpected)

    if (!id || id <= 0) {
      setLocalError('Invalid escrow ID')
      return
    }
    if (!aAmount || aAmount <= 0) {
      setLocalError('Invalid amount A')
      return
    }
    if (!bAmount || bAmount <= 0) {
      setLocalError('Invalid amount B expected')
      return
    }

    // Parse expiry time
    const timeMatch = expiryTime.match(/^(\d+):(\d+)$|^(\d+)h\s*(\d+)m?$|^(\d+)\s*h(?:ours?)?\s*(\d+)\s*m(?:in(?:utes?)?)?$/i)
    let hours = 0, minutes = 0

    if (timeMatch) {
      if (timeMatch[1] && timeMatch[2]) {
        // Format: "2:30"
        hours = parseInt(timeMatch[1]) || 0
        minutes = parseInt(timeMatch[2]) || 0
      } else if (timeMatch[3] && timeMatch[4]) {
        // Format: "2h 30m" or "2h30m"
        hours = parseInt(timeMatch[3]) || 0
        minutes = parseInt(timeMatch[4]) || 0
      } else if (timeMatch[5] && timeMatch[6]) {
        // Format: "2 hours 30 minutes"
        hours = parseInt(timeMatch[5]) || 0
        minutes = parseInt(timeMatch[6]) || 0
      }
    } else {
      setLocalError('Invalid time format. Use formats like "2:30", "2h 30m", or "2 hours 30 minutes"')
      return
    }

    if (hours < 0 || minutes < 0 || (hours === 0 && minutes === 0) || hours > 8760 || minutes > 59) {
      setLocalError('Invalid expiry time (minimum 1 minute, maximum 8760 hours, minutes 0-59)')
      return
    }
    if (!takerPubkey) {
      setLocalError('Taker pubkey is required')
      return
    }
    try {
      new PublicKey(takerPubkey) // Validate pubkey format
    } catch {
      setLocalError('Invalid taker pubkey format')
      return
    }

    // Confirmation with improved message
    const totalMinutes = hours * 60 + minutes
    const confirmMessage = `
      Create Escrow #${id}?

      You offer: ${aAmount} SOL
      You expect: ${bAmount} SOL
      Duration: ${totalMinutes} minutes (${hours}h ${minutes}m)
      Taker: ${takerPubkey.slice(0, 8)}...

      Your SOL will be locked until completion or expiry.
    `
    if (!confirm(confirmMessage.trim())) {
      return
    }

    setLoading(true)
    setMessage('')
    setLocalError('')
    setLocalSuccess('')

    try {
      const aAmountLamports = Math.floor(aAmount * LAMPORTS_PER_SOL)
      const bAmountLamports = Math.floor(bAmount * LAMPORTS_PER_SOL)
      const expiry = Math.floor(Date.now() / 1000) + (hours * 3600) + (minutes * 60)

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), publicKey.toBuffer(), new BN(id).toArrayLike(Buffer, 'le', 8)],
        program.programId
      )

      console.log('=== Creating Escrow ===')
      console.log('Escrow ID:', id)
      console.log('Maker:', publicKey.toBase58())
      console.log('Taker:', takerPubkey)
      console.log('Escrow PDA:', escrowPda.toBase58())
      console.log('Amount A (lamports):', aAmountLamports)
      console.log('Amount B expected (lamports):', bAmountLamports)
      console.log('Expiry timestamp:', expiry)

      const tx = await program.methods
        .createEscrow(new BN(id), new BN(aAmountLamports), new BN(bAmountLamports), new BN(expiry), new PublicKey(takerPubkey))
        .accounts({
          escrow: escrowPda,
          maker: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false })

      // Wait for confirmation with finalized commitment
      const connection = program.provider.connection
      const latestBlockhash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        signature: tx,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed')

      console.log('✓ Escrow created successfully')
      console.log('✓ Transaction confirmed')
      setMessage(`Escrow created successfully! TX: ${tx}`)
      setLocalSuccess(`Escrow created successfully!`)
      console.log('Transaction signature:', tx)
      console.log('View on explorer: https://explorer.solana.com/tx/' + tx + '?cluster=devnet')

      // Refresh balance after creating escrow
      refreshBalance()

      // Reset form
      setEscrowId('')
      setAmountA('')
      setAmountBExpected('')
      setExpiryTime('')
      setTakerPubkey('')

      // Refresh escrows
      await fetchMakerEscrows(false)
    } catch (error: any) {
      console.error('Create escrow error:', error)

      // Parse error message for user-friendly display. Handle network errors explicitly.
      let userFriendlyMessage = 'Transaction failed'

      // Detect network-level TypeError (e.g., "NetworkError when attempting to fetch resource")
      if (error instanceof TypeError || (error.name && error.name === 'TypeError')) {
        userFriendlyMessage = 'Network error: Unable to reach the Solana RPC endpoint. Check your internet connection or RPC configuration and try again.'
      } else if (error.message) {
        const errorMsg = typeof error.message === 'string' ? error.message.toLowerCase() : String(error.message).toLowerCase()

        if (errorMsg.includes('already in use')) {
          userFriendlyMessage = `Escrow ID #${id} already exists. Please choose a different ID.`
        } else if (errorMsg.includes('insufficient funds')) {
          userFriendlyMessage = 'Insufficient SOL balance to create this escrow.'
        } else if (errorMsg.includes('invalid public key')) {
          userFriendlyMessage = 'Invalid taker wallet address. Please check the address.'
        } else if (errorMsg.includes('custom program error')) {
          userFriendlyMessage = 'Transaction failed due to program constraints. Please try again.'
        } else if (errorMsg.includes('blockhash not found') || errorMsg.includes('failed to get recent blockhash') || errorMsg.includes('networkerror')) {
          userFriendlyMessage = 'Network error: Unable to reach the Solana RPC endpoint. Check your internet connection or RPC configuration and try again.'
        } else if (errorMsg.includes('simulation failed')) {
          userFriendlyMessage = 'Transaction simulation failed. Please check your inputs and try again.'
        } else {
          userFriendlyMessage = `Transaction failed: ${typeof error.message === 'string' ? error.message : String(error.message)}`
        }
      }

      setLocalError(userFriendlyMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Create New Escrow</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Escrow ID</label>
          <input
            type="number"
            value={escrowId}
            onChange={(e) => setEscrowId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            placeholder="Enter unique ID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">You Offer (SOL)</label>
          <input
            type="number"
            step="0.01"
            value={amountA}
            onChange={(e) => setAmountA(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            placeholder="Amount to offer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">You Expect (SOL)</label>
          <input
            type="number"
            step="0.01"
            value={amountBExpected}
            onChange={(e) => setAmountBExpected(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            placeholder="Amount expected"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Taker Public Key</label>
          <input
            type="text"
            value={takerPubkey}
            onChange={(e) => setTakerPubkey(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md font-mono text-sm text-white placeholder-gray-400"
            placeholder="Public key of the taker"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Expiry Time</label>
          <input
            type="text"
            value={expiryTime}
            onChange={(e) => setExpiryTime(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            placeholder="e.g., 2:30, 2h 30m, or 2 hours 30 minutes"
          />
          <p className="text-xs text-gray-400 mt-1">Accepted formats: 2:30, 2h 30m, 2 hours 30 minutes</p>
        </div>
      </div>

      <button
        onClick={createEscrow}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        disabled={!program || !publicKey}
      >
        Create Escrow
      </button>

      {localError && (
        <div className="mt-4 p-3 bg-red-900 border border-red-500 rounded text-red-200 text-sm">
          {localError}
        </div>
      )}

      {localSuccess && (
        <div className="mt-4 p-3 bg-green-900 border border-green-500 rounded text-green-200 text-sm">
          {localSuccess}
        </div>
      )}
    </div>
  )
}