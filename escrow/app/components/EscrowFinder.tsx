import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { useEscrow } from './EscrowContext'
import EscrowCard from './EscrowCard'

export default function EscrowFinder() {
  const { program, loading, setLoading, setMessage } = useEscrow()
  const [findEscrowId, setFindEscrowId] = useState('')
  const [findMakerPubkey, setFindMakerPubkey] = useState('')
  const [foundEscrow, setFoundEscrow] = useState<any>(null)
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

  // Function to refresh the found escrow data after state changes (like funding)
  const refreshFoundEscrow = async () => {
    if (!foundEscrow || !program) return

    try {
      const escrowAccount = await program.account.escrowAccount.fetch(foundEscrow.escrowPda)
      setFoundEscrow({ ...escrowAccount, escrowPda: foundEscrow.escrowPda, id: foundEscrow.id })
    } catch (error) {
      console.error('Error refreshing escrow data:', error)
      // If refresh fails, keep the current data
    }
  }

  const findEscrow = async () => {
    if (!program || !findEscrowId || !findMakerPubkey) {
      setLocalError('Please provide both Escrow ID and Maker Pubkey')
      return
    }

    setLoading(true)
    setMessage('')
    setLocalError('')
    setLocalSuccess('')
    setFoundEscrow(null)

    try {
      const id = parseInt(findEscrowId)

      if (isNaN(id) || id <= 0) {
        setLocalError('Invalid escrow ID')
        setLoading(false)
        return
      }

      // Validate and parse maker pubkey
      let makerPubkey: PublicKey
      try {
        makerPubkey = new PublicKey(findMakerPubkey)
      } catch (error) {
        setLocalError('Invalid maker pubkey format')
        setLoading(false)
        return
      }

      // Derive PDA using maker's pubkey (not connected wallet)
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), makerPubkey.toBuffer(), new BN(id).toArrayLike(Buffer, 'le', 8)],
        program.programId
      )

      const escrowAccount = await program.account.escrowAccount.fetch(escrowPda)

      // Validate that the escrow is still active
      const now = Date.now() / 1000
      const isExpired = now >= escrowAccount.expiryTs
      const isCompleted = escrowAccount.isCompleted ?? escrowAccount.is_completed ?? false
      const isActive = escrowAccount.isActive ?? escrowAccount.is_active ?? true

      if (isCompleted) {
        setLocalError('This escrow has already been completed and is no longer active.')
        setLoading(false)
        return
      }

      if (isExpired) {
        setLocalError('This escrow has expired and is no longer active.')
        setLoading(false)
        return
      }

      if (!isActive) {
        setLocalError('This escrow is no longer active.')
        setLoading(false)
        return
      }

      setFoundEscrow({ ...escrowAccount, escrowPda, id })
      setMessage('Escrow found successfully!')
      setLocalSuccess('Escrow found successfully!')
    } catch (error: any) {
      console.error('Find escrow error:', error)
      setFoundEscrow(null)

      // Provide user-friendly error message
      let userFriendlyMessage = 'Error finding escrow'

      if (error.message) {
        const errorMsg = typeof error.message === 'string' ? error.message.toLowerCase() : String(error.message).toLowerCase()
        if (errorMsg.includes('invalid public key')) {
          userFriendlyMessage = 'Invalid maker wallet address format.'
        } else {
          userFriendlyMessage = `Error: ${typeof error.message === 'string' ? error.message : String(error.message)}`
        }
      }

      setLocalError(userFriendlyMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Find Escrow</h2>

      <div className="space-y-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Escrow ID</label>
          <input
            type="number"
            value={findEscrowId}
            onChange={(e) => setFindEscrowId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            placeholder="Escrow ID (e.g., 1)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Maker Public Key</label>
          <input
            type="text"
            value={findMakerPubkey}
            onChange={(e) => setFindMakerPubkey(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md font-mono text-sm text-white placeholder-gray-400"
            placeholder="Maker's wallet address"
          />
        </div>

        <button
          onClick={findEscrow}
          disabled={loading || !findEscrowId || !findMakerPubkey}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Find Escrow'}
        </button>
      </div>

      {localError && (
        <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded text-red-200 text-sm">
          {localError}
        </div>
      )}

      {localSuccess && (
        <div className="mb-4 p-3 bg-green-900 border border-green-500 rounded text-green-200 text-sm">
          {localSuccess}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4">
        💡 Tip: You need both the Escrow ID and the Maker&apos;s wallet address to find an escrow
      </p>

      {foundEscrow && (
        <div className="border border-gray-600 rounded-lg p-4 bg-gray-700">
          <h3 className="font-semibold text-white mb-3 text-lg">Found Escrow</h3>
          <EscrowCard escrow={foundEscrow} onUpdate={refreshFoundEscrow} />
        </div>
      )}
    </div>
  )
}