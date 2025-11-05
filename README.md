# Escrow-dApp

A secure, trustless escrow service built on the Solana blockchain using the Anchor framework. This decentralized application enables users to create and participate in SOL escrow transactions without requiring a trusted third party.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contract](#smart-contract)
- [Frontend Application](#frontend-application)
- [Security Features](#security-features)
- [Installation & Setup](#installation--setup)
- [Deployment](#deployment)
- [Testing](#testing)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Overview

This project implements a **trustless SOL escrow system** on Solana, enabling secure peer-to-peer SOL exchanges. Users can create escrow offers, fund them, and complete transactions without intermediaries.

### How It Works

1. **Party A (Maker)** creates an escrow by depositing SOL and specifying the amount they want in return
2. **Party B (Taker)** finds the offer and funds it by depositing the required SOL amount
3. **Smart Contract** automatically exchanges the SOL when both parties have fulfilled their obligations
4. **No trusted third party** is needed - the blockchain enforces all rules automatically

## Features

### Core Functionality
- ✅ **Create Escrow**: Deposit SOL and specify exchange terms
- ✅ **Fund Escrow**: Accept existing escrow offers
- ✅ **Complete Swap**: Execute the SOL exchange atomically
- ✅ **Cancel Escrow**: Withdraw unfunded escrows (maker only)
- ✅ **Refund After Expiry**: Recover SOL from expired escrows
- ✅ **Find Escrows**: Search for specific escrow offers by ID and maker

### User Experience
- 🔄 **Real-time Balance Updates**: Automatic balance refresh after transactions
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean, intuitive interface with dark theme
- ⚡ **Fast Transactions**: Optimized for Solana's high throughput
- 🔍 **Escrow Discovery**: Browse all available escrow offers

### Security & Reliability
- 🛡️ **Non-custodial**: Users maintain full control of their funds
- ⚡ **Atomic Swaps**: Either both parties get their SOL or neither does
- ⏰ **Time-locked Protection**: Automatic protection against stuck funds
- 🔐 **Access Control**: Only authorized parties can perform actions
- 📊 **Event Logging**: All transactions are logged for transparency

## Architecture

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │────│  Smart Contract  │────│   Solana Chain  │
│   (Next.js)     │    │   (Anchor/Rust)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Smart Contract Architecture

- **Program ID**: `4BnPg8BniGiwC9Pop7b45gDqTV2vGERgUTBSHEDCrkR7`
- **Framework**: Anchor (Rust-based Solana framework)
- **Account Type**: Program-Derived Addresses (PDAs) for secure SOL storage
- **Instructions**: 5 core instructions (create, fund, complete, cancel, refund)

### Frontend Architecture

- **Framework**: Next.js 14 with React 18
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS for responsive design
- **State Management**: React Context for global escrow state
- **Wallet Integration**: Solana Wallet Adapter for multi-wallet support

## Smart Contract

### Core Data Structures

#### EscrowAccount
```rust
pub struct EscrowAccount {
    pub maker: Pubkey,           // Creator of the escrow
    pub taker: Option<Pubkey>,   // Funder of the escrow (set during funding)
    pub escrow_id: u64,          // Unique identifier for the escrow
    pub amount_a: u64,           // SOL amount offered by maker (in lamports)
    pub amount_b_expected: u64,  // SOL amount expected from taker (in lamports)
    pub is_funded: bool,         // Whether taker has deposited SOL
    pub is_active: bool,         // Whether escrow can be used
    pub is_completed: bool,      // Whether swap was completed
    pub expiry_ts: i64,          // Unix timestamp when escrow expires
    pub bump: u8,               // PDA bump seed
}
```

### Instructions

#### 1. Create Escrow
**Purpose**: Party A creates a new escrow offer
**Parameters**: `escrow_id`, `amount_a`, `amount_b_expected`, `expiry_ts`, `taker_pubkey`
**Security**: Validates amounts > 0, expiry in future, sufficient balance

#### 2. Fund Escrow
**Purpose**: Party B accepts the escrow offer
**Parameters**: `escrow_id`
**Security**: Validates escrow exists, not expired, caller is designated taker

#### 3. Complete Swap
**Purpose**: Execute the SOL exchange
**Parameters**: `escrow_id`
**Security**: Validates escrow funded, caller is taker, atomic transfer

#### 4. Cancel Escrow
**Purpose**: Maker withdraws unfunded escrow
**Parameters**: `escrow_id`
**Security**: Validates caller is maker, escrow unfunded, still active

#### 5. Refund After Expiry
**Purpose**: Maker recovers SOL from expired escrow
**Parameters**: `escrow_id`
**Security**: Validates expiry passed, caller is maker, escrow unfunded

### Security Features

#### Access Control
- **Maker-only operations**: Cancel, refund (only escrow creator)
- **Taker-only operations**: Fund, complete (only designated funder)
- **State validation**: Operations only allowed in correct states

#### Fund Protection
- **Time-locked**: Funds protected until expiry or completion
- **Atomic transfers**: Either both transfers succeed or both fail
- **PDA security**: SOL stored in program-controlled accounts

#### Input Validation
- **Amount validation**: Prevents zero-value escrows
- **Expiry validation**: Prevents already-expired escrows
- **Account validation**: Ensures all required accounts exist

## Frontend Application

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Wallet**: Solana Wallet Adapter
- **Smart Contract**: Anchor Client

### Key Components

#### EscrowContext
**Purpose**: Global state management for escrow operations
**Features**:
- Program initialization
- Escrow data fetching
- Transaction state management
- Balance refresh coordination
- Global messaging system

#### EscrowCard
**Purpose**: Display and interact with individual escrows
**Features**:
- Dynamic action buttons based on escrow state
- Real-time status indicators
- Transaction execution with error handling
- Responsive design for all screen sizes

#### BalanceDisplay
**Purpose**: Show real-time SOL balance
**Features**:
- Automatic balance updates after transactions
- Truncated address display
- Manual refresh option
- Loading states

#### CreateEscrowForm
**Purpose**: Create new escrow offers
**Features**:
- Form validation
- SOL amount conversion
- Expiry time selection
- Taker address specification

#### EscrowFinder
**Purpose**: Search for specific escrows
**Features**:
- Search by escrow ID and maker address
- Real-time validation
- Detailed escrow information display

### State Management

The application uses React Context for global state management:

```typescript
interface EscrowContextType {
  program: any                    // Anchor program instance
  escrows: any[]                  // User's escrows
  loading: boolean                // Transaction loading state
  message: string                 // User feedback messages
  balanceRefreshTrigger: number   // Balance update trigger
  // ... additional methods
}
```

## Security Features

### Smart Contract Security

1. **Non-custodial Design**
   - Users maintain control of their SOL at all times
   - No admin keys or privileged accounts

2. **Atomic Operations**
   - SOL transfers happen simultaneously
   - No partial transaction states

3. **Time-based Protection**
   - Automatic expiry prevents stuck funds
   - Refund mechanisms for expired escrows

4. **Access Control**
   - Strict permission checks for all operations
   - Only authorized parties can execute transactions

5. **Input Validation**
   - Comprehensive validation of all inputs
   - Prevention of invalid states

### Frontend Security

1. **Type Safety**
   - Full TypeScript implementation
   - Compile-time type checking

2. **Wallet Security**
   - Integration with audited wallet adapters
   - Secure transaction signing

3. **Input Sanitization**
   - Client-side validation
   - Prevention of invalid inputs

## Installation & Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** 1.70+ and Cargo
- **Solana CLI** 1.16+
- **Anchor CLI** 0.28+

### Smart Contract Setup

```bash
# Install dependencies
npm install

# Build the smart contract
anchor build

# Run tests
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd app

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment

### Smart Contract Deployment

1. **Configure Network**
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```

2. **Build and Deploy**
   ```bash
   anchor build
   anchor deploy
   ```

3. **Update Program ID**
   - Copy the deployed program ID
   - Update `declare_id!()` in `lib.rs`
   - Update `programs/escrow/src/lib.rs` with new ID

### Frontend Deployment

1. **Build Application**
   ```bash
   cd app
   npm run build
   ```

2. **Deploy to Vercel/Netlify**
   ```bash
   # For Vercel
   npx vercel --prod

   # For Netlify
   npm run build
   netlify deploy --prod --dir=out
   ```

## Testing

### Smart Contract Tests

```bash
# Run all tests
anchor test

# Run specific test
anchor test -- --test test_create_escrow

# Run with verbose output
anchor test -- --verbose
```

### Frontend Tests

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run linting
npm run lint
```

### Manual Testing Checklist

- [ ] Create escrow with valid parameters
- [ ] Fund escrow as designated taker
- [ ] Complete swap successfully
- [ ] Cancel unfunded escrow
- [ ] Refund expired escrow
- [ ] Handle invalid inputs gracefully
- [ ] Test wallet disconnection/reconnection
- [ ] Verify balance updates after transactions

## Usage

### For Users

1. **Connect Wallet**: Click "Select Wallet" and choose your Solana wallet
2. **Create Escrow**: Enter SOL amount, expected return amount, and expiry time
3. **Share Details**: Provide escrow ID and your wallet address to potential takers
4. **Wait for Funding**: Monitor your escrows for funding
5. **Complete Transactions**: Accept funded escrows to complete the exchange

### For Developers

```typescript
// Initialize escrow context
const { program, fetchMakerEscrows } = useEscrow()

// Create new escrow
await program.methods
  .createEscrow(escrowId, amountA, amountB, expiry, takerPubkey)
  .accounts({ ... })
  .rpc()

// Fetch user's escrows
await fetchMakerEscrows()
```

## API Reference

### Smart Contract Instructions

#### `create_escrow`
```rust
pub fn create_escrow(
    ctx: Context<CreateEscrow>,
    escrow_id: u64,
    amount_a: u64,
    amount_b_expected: u64,
    expiry_ts: i64,
    taker_pubkey: Pubkey,
) -> Result<()>
```

#### `fund_escrow`
```rust
pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()>
```

#### `complete_swap`
```rust
pub fn complete_swap(ctx: Context<CompleteSwap>) -> Result<()>
```

#### `cancel_escrow`
```rust
pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()>
```

#### `refund_after_expiry`
```rust
pub fn refund_after_expiry(ctx: Context<RefundAfterExpiry>) -> Result<()>
```

### Frontend Hooks

#### `useEscrow()`
Returns the escrow context with all state and methods.

#### `useWallet()`
Returns wallet connection state and methods.

## Contributing

We welcome contributions to improve the Escrow-dApp!

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/MuhKar1/Escrow-dApp.git`
3. Install dependencies: `npm install`
4. Start development: `npm run dev`

### Code Standards

- **Rust**: Follow standard Rust formatting (`cargo fmt`)
- **TypeScript**: Use ESLint and Prettier
- **Commits**: Use conventional commit format
- **Tests**: Add tests for new features

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes and add tests
3. Ensure all tests pass: `npm test && anchor test`
4. Update documentation if needed
5. Submit a pull request with a clear description

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### MIT License Summary

- ✅ **Commercial Use**: You can use this software for commercial purposes
- ✅ **Modification**: You can modify the software
- ✅ **Distribution**: You can distribute the software
- ✅ **Private Use**: You can use this software privately
- ⚠️ **Liability**: No warranty or liability from the authors
- ⚠️ **Trademark**: No trademark rights granted

## Disclaimer

This software is provided "as is" without warranty of any kind. Use at your own risk. Always test thoroughly before using in production environments. The authors are not responsible for any financial losses incurred through the use of this software.

## Support

- **Issues**: [GitHub Issues](https://github.com/MuhKar1/Escrow-dApp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MuhKar1/Escrow-dApp/discussions)
- **Documentation**: See inline code comments and this README

## Acknowledgments

- **Anchor Framework**: For simplifying Solana smart contract development
- **Solana Labs**: For the Solana blockchain infrastructure
- **Open Source Community**: For the libraries and tools used in this project
