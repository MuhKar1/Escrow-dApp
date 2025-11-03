/**
 * Escrow Context - Global State Management for Escrow Operations
 *
 * This context provides centralized state management for all escrow-related operations
 * in the Escrow-dApp. It handles:
 * - Smart contract program initialization
 * - Escrow data fetching and caching
 * - Transaction state management
 * - Balance refresh coordination
 * - Global messaging system
 *
 * The context uses React Context API to make escrow state available throughout
 * the component tree without prop drilling.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import escrowIdl from '../../target/idl/escrow.json'

/**
 * EscrowContextType Interface
 *
 * Defines the shape of the context object that components can access.
 * Includes all state variables and functions needed for escrow operations.
 */
interface EscrowContextType {
  program: any                    // Anchor program instance for smart contract interactions
  escrows: any[]                  // User's created escrows
  allEscrows: any[]               // All escrows in the system
  loading: boolean                // Global loading state for transactions
  message: string                 // Global message for user feedback
  balanceRefreshTrigger: number   // Counter to trigger balance updates
  setLoading: (loading: boolean) => void
  setMessage: (message: string) => void
  setEscrows: (escrows: any[]) => void
  fetchMakerEscrows: () => Promise<void>    // Fetch escrows created by current user
  fetchAllEscrows: () => Promise<void>      // Fetch all escrows in system
  refreshBalance: () => void                // Trigger balance refresh across components
}

/**
 * EscrowContext - React Context Object
 *
 * The actual context object. Components use useEscrow() hook to access this.
 */
const EscrowContext = createContext<EscrowContextType | undefined>(undefined)

/**
 * EscrowProvider Component - Context Provider
 *
 * Wraps the application and provides escrow state to all child components.
 * Handles program initialization, data fetching, and state coordination.
 */
export function EscrowProvider({ children }: { children: React.ReactNode }) {
  // Wallet and connection hooks from Solana wallet adapter
  const wallet = useAnchorWallet()
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()

  // State variables for escrow data and UI state
  const [program, setProgram] = useState<any>(null)           // Smart contract program instance
  const [escrows, setEscrows] = useState<any[]>([])          // User's escrows
  const [allEscrows, setAllEscrows] = useState<any[]>([])    // All system escrows
  const [loading, setLoading] = useState(false)              // Transaction loading state
  const [message, setMessage] = useState('')                 // User feedback messages
  const [balanceRefreshTrigger, setBalanceRefreshTrigger] = useState(0)  // Balance update trigger

  /**
   * Program Initialization Effect
   *
   * Initializes the Anchor program when wallet is connected.
   * Creates a provider and program instance for smart contract interactions.
   */
  useEffect(() => {
    if (connected && publicKey && wallet) {
      try {
        // Create Anchor provider with confirmed commitment level
        const provider = new AnchorProvider(
          connection,
          wallet,
          { commitment: 'confirmed' }
        )

        // Initialize program with IDL (Interface Definition Language)
        const program = new Program(escrowIdl as any, provider)
        setProgram(program)
      } catch (error) {
        console.error('Error initializing program:', error)
        setMessage('Error initializing program')
      }
    }
  }, [connected, publicKey, connection, wallet])

  /**
   * fetchMakerEscrows Function
   *
   * Fetches all escrows created by the current user (maker).
   * This is used to display the user's own escrow offers.
   *
   * Process:
   * 1. Query all program accounts of type EscrowAccount
   * 2. Filter accounts where maker equals current user
   * 3. Sort by escrow ID (newest first)
   * 4. Update local state with filtered results
   */
  const fetchMakerEscrows = useCallback(async () => {
    if (!program || !publicKey) return

    setLoading(true)
    try {
      const connection = program.provider.connection

      console.log('=== Fetching Escrows ===')
      console.log('Program ID:', program.programId.toBase58())
      console.log('Your wallet:', publicKey.toBase58())

      // Get all program accounts (raw data) without filtering
      const accounts = await connection.getProgramAccounts(program.programId)

      console.log(`Total escrow accounts found: ${accounts.length}`)

      if (accounts.length === 0) {
        console.log('⚠️ No escrow accounts found for this program!')
        console.log('This could mean:')
        console.log('1. No escrows have been created yet')
        console.log('2. Escrows were created with a different program version')
        console.log('3. Transactions failed to create accounts')
        console.log('4. Wrong program ID being used')
      }

      // Try to decode each account, skip any that fail, then filter by maker
      const decodedAccounts: any[] = []

      accounts.forEach(({ pubkey, account }: any) => {
        try {
          const decoded = program.coder.accounts.decode('EscrowAccount', account.data)
          console.log(`✓ Decoded account ${pubkey.toBase58()}, maker: ${decoded.maker.toBase58()}`)
          decodedAccounts.push({
            ...decoded,
            isCompleted: decoded.isCompleted ?? decoded.is_completed ?? false,
            isFunded: decoded.isFunded ?? decoded.is_funded ?? false,
            isActive: decoded.isActive ?? decoded.is_active ?? true,
            escrowPda: pubkey,
            escrowId: decoded.escrowId?.toNumber?.() ?? decoded.escrow_id?.toNumber?.() ?? 0,
            amountA: decoded.amountA ?? decoded.amount_a ?? 0,
            amountBExpected: decoded.amountBExpected ?? decoded.amount_b_expected ?? 0,
            expiryTs: decoded.expiryTs ?? decoded.expiry_ts ?? 0,
          })
        } catch (err) {
          console.warn(`✗ Skipping incompatible escrow account: ${pubkey.toString()}`, err)
        }
      })

      console.log(`Successfully decoded: ${decodedAccounts.length} accounts`)

      // Filter by maker
      const formattedEscrows = decodedAccounts
        .filter((e: any) => {
          try {
            const isMaker = e.maker.equals(publicKey)
            if (isMaker) {
              console.log(`✓ Found your escrow:`, e.escrowPda.toBase58())
            }
            return isMaker
          } catch (err) {
            console.error('Error checking maker:', err)
            return false
          }
        })
        .sort((a: any, b: any) => (b.escrowId || 0) - (a.escrowId || 0)) // Sort by escrow ID (newest first)

      console.log(`Escrows for maker ${publicKey.toBase58()}: ${formattedEscrows.length}`)
      setEscrows(formattedEscrows)
      setMessage(formattedEscrows.length > 0 ? `Found ${formattedEscrows.length} escrow(s)` : 'No escrows found')
    } catch (error: any) {
      console.error('Error fetching escrows:', error)
      setMessage('Error loading escrows: ' + (error.message ? (typeof error.message === 'string' ? error.message : String(error.message)) : 'Unknown error'))
      setEscrows([])
    } finally {
      setLoading(false)
    }
  }, [program, publicKey])

  /**
   * fetchAllEscrows Function
   *
   * Fetches all escrows in the entire system (not just user's).
   * This is used to show all available escrow offers for funding.
   *
   * Process:
   * 1. Query all program accounts owned by the escrow program
   * 2. Decode account data using Anchor's account decoder
   * 3. Handle backward compatibility for different field names
   * 4. Filter out incompatible accounts from old program versions
   * 5. Sort by creation time (newest first)
   * 6. Update global state with all valid escrows
   */
  const fetchAllEscrows = useCallback(async () => {
    if (!program) return

    setLoading(true)
    try {
      const connection = program.provider.connection

      console.log('=== Fetching All Escrows ===')
      console.log('Program ID:', program.programId.toBase58())

      // Get all program accounts (raw data)
      const accounts = await connection.getProgramAccounts(program.programId)

      console.log(`Total escrow accounts found: ${accounts.length}`)

      if (accounts.length === 0) {
        console.log('⚠️ No escrow accounts found for this program!')
        setAllEscrows([])
        setMessage('No escrows found in the system')
        return
      }

      // Debug: Log account structure
      console.log('First account structure:', accounts[0])
      console.log('Account data length:', accounts[0]?.account?.data?.length)
      console.log('Sample account data lengths:', accounts.slice(0, 3).map((acc: any) => acc.account?.data?.length || 'undefined'))

      // Try to decode each account, skip any that fail
      const decodedAccounts: any[] = []
      let incompatibleCount = 0

      accounts.forEach(({ pubkey, account }: any, index: number) => {
        console.log(`Attempting to decode account ${index + 1}/${accounts.length}: ${pubkey.toBase58()}`)
        console.log(`Account data length: ${account.data.length}`)
        const discriminator = Array.from(account.data.slice(0, 8))
        console.log(`Account discriminator:`, discriminator)
        console.log(`Expected discriminator: [36, 69, 48, 18, 128, 225, 125, 135]`)
        console.log(`Discriminator matches:`, JSON.stringify(discriminator) === JSON.stringify([36, 69, 48, 18, 128, 225, 125, 135]))
        
        try {
          const decoded = program.coder.accounts.decode('EscrowAccount', account.data)
          console.log(`✓ Successfully decoded account ${pubkey.toBase58()}:`, decoded)
          console.log(`Raw decoded object keys:`, Object.keys(decoded))
          decodedAccounts.push({
            ...decoded,
            isCompleted: decoded.isCompleted ?? decoded.is_completed ?? false,
            isFunded: decoded.isFunded ?? decoded.is_funded ?? false,
            isActive: decoded.isActive ?? decoded.is_active ?? true,
            escrowPda: pubkey,
            escrowId: decoded.escrowId?.toNumber?.() ?? decoded.escrow_id?.toNumber?.() ?? 0,
            amountA: decoded.amountA ?? decoded.amount_a ?? 0,
            amountBExpected: decoded.amountBExpected ?? decoded.amount_b_expected ?? 0,
            expiryTs: decoded.expiryTs ?? decoded.expiry_ts ?? 0,
          })
        } catch (err) {
          incompatibleCount++
          console.warn(`✗ Failed to decode escrow account ${index + 1}: ${pubkey.toString()}`, err)
          console.warn(`Error details:`, err instanceof Error ? err.message : String(err))
        }
      })

      console.log(`Successfully decoded: ${decodedAccounts.length} accounts`)
      
      if (incompatibleCount > 0) {
        console.log(`⚠️ Skipped ${incompatibleCount} incompatible account(s) from old program versions`)
      }

      // Sort by creation time (newest first) - using escrowId as proxy for creation order
      const sortedEscrows = decodedAccounts.sort((a: any, b: any) => b.escrowId - a.escrowId)

      console.log(`All escrows in system: ${sortedEscrows.length}`)
      setAllEscrows(sortedEscrows)
    } catch (error: any) {
      console.error('Error fetching all escrows:', error)
      setMessage('Error loading escrows: ' + (error.message ? (typeof error.message === 'string' ? error.message : String(error.message)) : 'Unknown error'))
      setAllEscrows([])
    } finally {
      setLoading(false)
    }
  }, [program])

  /**
   * Auto-fetch Effect
   *
   * Automatically fetches all escrows when the program is initialized.
   * This ensures the UI is populated with data when the user connects their wallet.
   */
  useEffect(() => {
    if (program) {
      fetchAllEscrows()
    }
  }, [program, fetchAllEscrows])

  /**
   * refreshBalance Function
   *
   * Triggers a balance refresh across all components that display wallet balance.
   * This is called after successful transactions that affect SOL balance.
   *
   * How it works:
   * - Increments a counter (balanceRefreshTrigger)
   * - Components listening to this trigger will refresh their balance
   * - Provides real-time balance updates without manual refresh
   */
  const refreshBalance = useCallback(() => {
    setBalanceRefreshTrigger(prev => prev + 1)
  }, [])

  /**
   * Context Value Object
   *
   * The object containing all state and functions that child components can access.
   * This is passed to the Context.Provider and made available via useEscrow() hook.
   */
  const value = {
    program,                    // Smart contract program instance
    escrows,                    // User's created escrows
    allEscrows,                 // All escrows in the system
    loading,                    // Global loading state
    message,                    // Global message for user feedback
    balanceRefreshTrigger,      // Counter for triggering balance updates
    setLoading,                 // Function to set loading state
    setMessage,                 // Function to set global message
    setEscrows,                 // Function to update user's escrows
    fetchMakerEscrows,          // Function to fetch user's escrows
    fetchAllEscrows,            // Function to fetch all system escrows
    refreshBalance,             // Function to trigger balance refresh
  }

  /**
   * Context Provider Return
   *
   * Returns the EscrowContext.Provider wrapping the children.
   * This makes all escrow state and functions available to child components.
   */
  return (
    <EscrowContext.Provider value={value}>
      {children}
    </EscrowContext.Provider>
  )
}

/**
 * useEscrow Hook
 *
 * Custom hook for accessing escrow context.
 * Must be used within an EscrowProvider component.
 *
 * Usage: const { program, loading, fetchAllEscrows } = useEscrow()
 */
export function useEscrow() {
  const context = useContext(EscrowContext)
  if (context === undefined) {
    throw new Error('useEscrow must be used within an EscrowProvider')
  }
  return context
}