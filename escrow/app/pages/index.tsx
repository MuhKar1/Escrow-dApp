/**
 * Escrow-dApp - Main Application Page
 *
 * This is the main user interface for the Solana Escrow Decentralized Application.
 * It provides a complete web interface for users to interact with the escrow smart contract
 * deployed on the Solana blockchain.
 *
 * Key Features:
 * - Wallet connection and management
 * - Real-time SOL balance display
 * - Escrow creation and management
 * - Escrow discovery and funding
 * - Transaction status and feedback
 *
 * The application follows a component-based architecture using React and Next.js,
 * with state management handled through React Context.
 */

'use client'

// Import external libraries and components
import { WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'

// Import our custom components and context
import { EscrowProvider, useEscrow } from '../components/EscrowContext'
import BalanceDisplay from '../components/BalanceDisplay'
import CreateEscrowForm from '../components/CreateEscrowForm'
import EscrowFinder from '../components/EscrowFinder'
import MessageDisplay from '../components/MessageDisplay'
import TimeDisplay from '../components/TimeDisplay'
import LoadingSpinner from '../components/LoadingSpinner'

/**
 * HomeContent Component - Main Application Logic
 *
 * This component contains all the main application logic and UI.
 * It's wrapped by the EscrowProvider to have access to escrow state.
 */
function HomeContent() {
  // Access escrow context for global state management
  const { message, setMessage, loading } = useEscrow()

  // Access wallet state from Solana wallet adapter
  const { connected, publicKey } = useWallet()

  // Track if component has mounted (prevents hydration issues)
  const [mounted, setMounted] = useState(false)

  // Set mounted to true after component mounts
  useEffect(() => {
    setMounted(true)
  }, [])

  /**
   * Utility function to shorten wallet addresses for display
   * Shows first 4 and last 4 characters with ellipsis in between
   * Example: "G9di...sV5y" instead of full address
   */
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  /**
   * Determine message type for styling based on content
   * Returns 'success', 'error', or 'info' for appropriate styling
   */
  const getMessageType = (): 'success' | 'error' | 'info' => {
    if (message.toLowerCase().includes('success') || message.toLowerCase().includes('found')) {
      return 'success'
    } else if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
      return 'error'
    }
    return 'info'
  }

  // Main application UI render
  return (
    // Main container with dark theme and responsive padding
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors relative">
      {/* Global Loading Overlay - Shows during any transaction */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-white">Processing transaction...</p>
          </div>
        </div>
      )}

      {/* Main content container with max width and spacing */}
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-8">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-white">Escrow-dApp</h1>
            <p className="mt-2 text-gray-300">Secure SOL escrow transactions on Solana</p>
          </div>
          {/* Current time display in top right */}
          <TimeDisplay />
        </div>

        {/* Message Display - Shows transaction results and feedback */}
        <MessageDisplay message={message} type={getMessageType()} onDismiss={() => setMessage('')} />

        {/* Pre-Connection Information - Only shown before wallet connection */}
        {!connected && mounted && (
          <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg shadow-md p-6 border border-blue-700">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Welcome to Escrow-dApp</h3>
              </div>

              <p className="text-gray-300 text-lg leading-relaxed">
                A secure, non-custodial escrow platform for trustless peer-to-peer SOL token exchanges on Solana blockchain.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">🔐 Your Security First</h4>
                  <p className="text-gray-300 text-sm">
                    Non-custodial design — private keys never leave the connected wallet. Transactions are signed locally and submitted to the Solana network. Smart contract logic enforces atomic swaps and refund rules.
                  </p>
                </div>

                <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-2">🌐 Open to Everyone</h4>
                  <p className="text-gray-300 text-sm">
                    Anyone can create escrow agreements. Multiple users can participate simultaneously in secure SOL exchanges.
                  </p>
                </div>
              </div>

              <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded-lg p-4 mt-4">
                <p className="text-yellow-300 text-sm">
                  <strong>⚠️ Devnet Environment:</strong> This application is currently deployed on Solana devnet for testing purposes.
                  Use test SOL tokens only.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Connection Section */}
        <div className="bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Wallet Connection</h2>
          {/* Prevent hydration mismatch by checking if component is mounted */}
          {!mounted ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                <p className="text-yellow-400 font-medium">Loading Wallet</p>
              </div>
              <p className="text-gray-300 text-sm">Initializing wallet connection...</p>
            </div>
          ) : !connected ? (
            // Wallet not connected state
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <p className="text-red-400 font-medium">Wallet Not Connected</p>
              </div>
              <p className="text-gray-300">Connect a wallet to create, find, fund, and complete escrows. The connected wallet must authorize transactions; private keys remain in the wallet and are never shared.</p>
              {/* Wallet connection button from Solana wallet adapter */}
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !text-white !font-medium !px-6 !py-2 !rounded-lg !transition-colors" />
            </div>
          ) : (
            // Wallet connected state
            <div className="space-y-6">
              {/* Connection Status Card */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  {/* Green indicator showing connected status */}
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-green-400 font-medium">Wallet Connected</p>
                </div>
                {/* Disconnect button */}
                <WalletDisconnectButton className="!bg-red-600 hover:!bg-red-700 !text-white !font-medium !px-4 !py-2 !rounded-lg !transition-colors" />
              </div>

              {/* Balance Display Section */}
              <div className="border-t border-gray-600 pt-4">
                <BalanceDisplay />
              </div>
            </div>
          )}
        </div>

        {/* Create Escrow Form - Only shown when wallet is connected */}
        {connected && <CreateEscrowForm />}

        {/* Escrow Finder - Search and interact with existing escrows */}
        {connected && <EscrowFinder />}
      </div>
    </div>
  )
}

/**
 * Home Component - Application Entry Point
 *
 * This is the main export that wraps the application with the EscrowProvider
 * context provider, making escrow state available throughout the component tree.
 */
export default function Home() {
  return (
    <EscrowProvider>
      <HomeContent />
    </EscrowProvider>
  )
}
