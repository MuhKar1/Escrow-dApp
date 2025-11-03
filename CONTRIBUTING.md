# Contributing to Escrow-dApp

Thank you for your interest in contributing to the Escrow-dApp! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. By participating, you agree to:

- Be respectful and inclusive
- Focus on constructive feedback
- Accept responsibility for mistakes
- Show empathy towards other contributors
- Help create a positive community

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and npm
- **Rust** 1.70+ and Cargo
- **Solana CLI** 1.16+
- **Anchor CLI** 0.28+
- **Git** 2.0+

### Quick Setup

```bash
# Fork and clone the repository
git clone https://github.com/MuhKar1/Escrow-dApp.git
cd Escrow-dApp

# Install dependencies
npm install

# Set up Solana CLI
solana config set --url https://api.devnet.solana.com

# Start development
npm run dev
```

## Development Setup

### Smart Contract Development

```bash
# Build the smart contract
anchor build

# Run tests
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Frontend Development

```bash
# Navigate to frontend
cd app

# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build
```

## Project Structure

```
Escrow-dApp/
├── programs/escrow/           # Smart contract (Rust/Anchor)
│   ├── src/
│   │   ├── lib.rs            # Main contract logic
│   │   └── state.rs          # Data structures (if separated)
│   ├── Cargo.toml            # Rust dependencies
│   └── Xargo.toml
├── app/                       # Frontend application (Next.js)
│   ├── components/           # React components
│   ├── pages/                # Next.js pages
│   ├── styles/               # CSS styles
│   ├── utils/                # Utility functions
│   └── package.json          # Node.js dependencies
├── tests/                     # Integration tests
├── migrations/               # Deployment scripts
├── target/                   # Build artifacts
├── Anchor.toml               # Anchor configuration
├── package.json              # Root package.json
└── README.md                 # Project documentation
```

## Development Workflow

### 1. Choose an Issue

- Check the [Issues](https://github.com/MuhKar1/Escrow-dApp/issues) page
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to indicate you're working on it

### 2. Create a Branch

```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 3. Make Changes

- Write clear, focused commits
- Test your changes thoroughly
- Follow the coding standards below

### 4. Test Your Changes

```bash
# Run smart contract tests
anchor test

# Run frontend tests
npm test

# Manual testing checklist
- [ ] Create escrow functionality works
- [ ] Fund escrow functionality works
- [ ] Complete swap functionality works
- [ ] Cancel escrow functionality works
- [ ] Refund functionality works
- [ ] UI is responsive
- [ ] Error handling works properly
```

### 5. Submit a Pull Request

- Ensure your branch is up to date with main
- Write a clear PR description
- Reference any related issues
- Request review from maintainers

## Coding Standards

### Rust/Smart Contract Standards

- Follow the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `cargo fmt` for code formatting
- Use `cargo clippy` for linting
- Write comprehensive documentation comments (`///`)
- Use meaningful variable and function names
- Handle errors properly with `Result<T, E>`

#### Example Code Style

```rust
/// Creates a new escrow with the specified parameters.
///
/// This function validates all inputs and creates a program-derived address
/// to securely store the escrow SOL.
///
/// # Arguments
///
/// * `ctx` - The instruction context containing accounts
/// * `escrow_id` - Unique identifier for the escrow
/// * `amount_a` - Amount of SOL the maker is offering
/// * `amount_b_expected` - Amount of SOL expected from taker
/// * `expiry_ts` - Unix timestamp when escrow expires
/// * `taker_pubkey` - Public key of the designated taker
///
/// # Returns
///
/// Returns `Ok(())` on success, or an error if validation fails
pub fn create_escrow(
    ctx: Context<CreateEscrow>,
    escrow_id: u64,
    amount_a: u64,
    amount_b_expected: u64,
    expiry_ts: i64,
    taker_pubkey: Pubkey,
) -> Result<()> {
    // Input validation
    require!(amount_a > 0, EscrowError::InvalidAmount);
    require!(amount_b_expected > 0, EscrowError::InvalidAmount);

    // Implementation...
    Ok(())
}
```

### TypeScript/React Standards

- Use TypeScript for all new code
- Follow the [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- Use functional components with hooks
- Use meaningful component and variable names
- Write comprehensive JSDoc comments
- Use ESLint and Prettier for code formatting

#### Example Component Structure

```typescript
/**
 * BalanceDisplay Component
 *
 * Displays the current SOL balance of the connected wallet.
 * Automatically refreshes after transactions.
 */
interface BalanceDisplayProps {
  className?: string
}

export default function BalanceDisplay({ className = '' }: BalanceDisplayProps) {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const { balanceRefreshTrigger } = useEscrow()

  // Component logic...

  return (
    <div className={`balance-display ${className}`}>
      {/* JSX content */}
    </div>
  )
}
```

### Commit Message Standards

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat: add escrow expiry functionality
fix: resolve balance display bug on mobile
docs: update API documentation
test: add unit tests for escrow validation
```

## Testing

### Smart Contract Testing

```bash
# Run all tests
anchor test

# Run specific test file
anchor test -- --test test_create_escrow

# Run with verbose output
anchor test -- --nocapture
```

### Frontend Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests (if implemented)
npm run test:e2e
```

### Manual Testing Checklist

Before submitting a PR, ensure:

- [ ] Smart contract compiles without warnings
- [ ] All existing tests pass
- [ ] New functionality has appropriate tests
- [ ] Frontend builds without errors
- [ ] UI works on different screen sizes
- [ ] Error states are handled gracefully
- [ ] Wallet disconnection/reconnection works
- [ ] Balance updates correctly after transactions

## Submitting Changes

### Pull Request Process

1. **Ensure your branch is up to date**
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```

2. **Write clear commit messages**
   ```bash
   git commit -m "feat: add automatic balance refresh after transactions"
   ```

3. **Create a Pull Request**
   - Use a descriptive title
   - Provide detailed description of changes
   - Reference related issues
   - Add screenshots for UI changes

4. **PR Template**
   ```markdown
   ## Description
   Brief description of the changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] All tests pass
   - [ ] Manual testing completed
   - [ ] UI tested on multiple devices

   ## Screenshots (if applicable)
   Add screenshots of UI changes

   ## Checklist
   - [ ] Code follows project standards
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] No breaking changes
   ```

### Code Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, your PR will be merged
- Your contribution will be acknowledged

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Description**: Clear description of the issue
- **Steps to reproduce**: Step-by-step instructions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, browser, wallet type, etc.
- **Screenshots**: If applicable
- **Console errors**: Browser console output

### Feature Requests

For feature requests, please include:

- **Description**: What feature you'd like to see
- **Use case**: Why this feature would be useful
- **Implementation ideas**: If you have thoughts on how to implement it
- **Alternatives**: Other solutions you've considered

### Security Issues

For security-related issues:

- **DO NOT** create a public GitHub issue
- Email the maintainers directly
- Provide detailed information about the vulnerability
- Allow time for the issue to be addressed before public disclosure

## Recognition

Contributors will be recognized in:
- The project's README.md
- GitHub's contributor insights
- Release notes for significant contributions

Thank you for contributing to the Escrow-dApp!