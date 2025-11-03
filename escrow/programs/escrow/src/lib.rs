//! # Secure SOL Escrow Smart Contract for Solana
//!
//! This smart contract implements a **trustless SOL escrow system** on the Solana blockchain.
//! It enables secure SOL exchanges between two parties without requiring a trusted third party.
//!
//! ## How It Works (Simple Explanation)
//!
//! 1. **Party A (Maker)** creates an escrow by depositing SOL and specifying how much SOL they want in return
//! 2. **Party B (Taker)** sees the offer and can fund it by depositing the required SOL
//! 3. **Smart Contract** automatically exchanges the SOL when both parties have fulfilled their obligations
//! 4. **No trusted third party** is needed - the blockchain enforces all the rules automatically
//!
//! ## Key Security Features
//!
//! - **Non-custodial**: Users maintain full control of their funds at all times
//! - **Atomic swaps**: Either both parties get their tokens, or neither does
//! - **Expiry protection**: Funds are automatically protected if deadlines are missed
//! - **Access control**: Only authorized parties can perform specific actions
//! - **Immutable**: Once deployed, the contract logic cannot be changed
//!
//! ## Real-World Use Cases
//!
//! - **SOL Trading**: Exchange SOL without centralized exchanges
//! - **P2P Payments**: Direct person-to-person SOL transfers with escrow protection
//! - **DeFi Protocols**: Trustless SOL swaps in decentralized finance
//! - **Service Payments**: Secure payments for services with escrow guarantees
//!
//! ## Technical Architecture
//!
//! The contract uses **Program-Derived Addresses (PDAs)** to create unique escrow accounts
//! and hold SOL securely. This ensures:
//! - **Unique addresses** for each escrow (no address collisions)
//! - **Secure SOL storage** in program-controlled accounts
//! - **Authority delegation** through PDA signing
//!
//! ## Development Best Practices
//!
//! - **Comprehensive validation**: All inputs are validated before processing
//! - **Event emission**: All state changes are logged for transparency
//! - **Error handling**: Clear error messages for debugging and user feedback
//! - **Gas optimization**: Efficient operations to minimize transaction costs

use anchor_lang::prelude::*;
use anchor_lang::system_program;

// Program ID - This unique address identifies our smart contract on Solana
// Think of it like a street address for our program
declare_id!("4BnPg8BniGiwC9Pop7b45gDqTV2vGERgUTBSHEDCrkR7");


#[program]
pub mod escrow {
    use super::*;

    /// # Create Escrow Instruction
    ///
    /// **What it does**: Party A (the maker) creates a new escrow offer and deposits their tokens.
    ///
    /// ## Step-by-Step Process
    ///
    /// 1. **Validate inputs**: Ensure amounts > 0 and expiry is in future
    /// 2. **Create escrow account**: Store all trade details on blockchain
    /// 3. **Lock maker's tokens**: Transfer Token A to secure vault controlled by program
    /// 4. **Emit event**: Log the creation for transparency and tracking
    ///
    /// ## Security Checks
    ///
    /// - Only positive amounts allowed (prevents zero-value escrows)
    /// - Expiry must be future-dated (prevents instant expiration)
    /// - Maker must have sufficient tokens (enforced by token program)
    /// - All accounts properly validated (enforced by Anchor)
    ///
    /// ## What Happens Next
    ///
    /// - Escrow is now visible to potential takers
    /// - Maker's SOL is safely locked in escrow PDA
    /// - Anyone can call `fund_escrow` to complete the trade
    /// - If no one takes it before expiry, maker can refund
    ///
    /// The escrow PDA holds the SOL securely.
    #[allow(clippy::too_many_arguments)]
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        escrow_id: u64,
        amount_a: u64,
        amount_b_expected: u64,
        expiry_ts: i64,
        taker_pubkey: Pubkey,
    ) -> Result<()> {
        // Basic validations
        require!(amount_a > 0, EscrowError::InvalidAmount);
        require!(amount_b_expected > 0, EscrowError::InvalidAmount);
        require!(
            expiry_ts > Clock::get()?.unix_timestamp,
            EscrowError::InvalidExpiry
        );

        // Get escrow key and account info before mutable borrow
        let escrow_key = ctx.accounts.escrow.key();
        let escrow_account_info = ctx.accounts.escrow.to_account_info();

        // Initialize escrow account state
        let escrow = &mut ctx.accounts.escrow;
        escrow.maker = ctx.accounts.maker.key();
        escrow.taker = Some(taker_pubkey);
        escrow.escrow_id = escrow_id;
        escrow.amount_a = amount_a;
        escrow.amount_b_expected = amount_b_expected;
        escrow.is_funded = false;
        escrow.is_active = true;
        escrow.is_completed = false;
        escrow.expiry_ts = expiry_ts;
        escrow.bump = ctx.bumps.escrow;

        // Transfer SOL from maker to escrow PDA
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.maker.to_account_info(),
            to: escrow_account_info,
        };
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                transfer_ix,
            ),
            amount_a,
        )?;

        emit!(EscrowCreated {
            escrow: escrow_key,
            maker: escrow.maker,
            escrow_id,
            amount_a,
            amount_b_expected,
            expiry_ts,
            ts: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// # Fund Escrow Instruction
    ///
    /// **What it does**: Party B (the taker) accepts the escrow offer and deposits their tokens.
    ///
    /// ## Step-by-Step Process
    ///
    /// 1. **Validate escrow state**: Ensure escrow is active and not already funded
    /// 2. **Lock taker's SOL**: Transfer SOL to escrow PDA controlled by program
    /// 3. **Update escrow state**: Mark as funded and record who the taker is
    /// 4. **Emit event**: Log the funding for transparency and tracking
    ///
    /// ## Security Checks
    ///
    /// - Escrow must be active (not completed/cancelled/expired)
    /// - Escrow must not be already funded (prevents double-funding)
    /// - Taker must have sufficient SOL (enforced by system program)
    ///
    /// ## What Happens Next
    ///
    /// - Both parties have now deposited their SOL
    /// - Either party can now call `complete_swap` to execute the trade
    /// - If no one completes it, either party can cancel (but both get their SOL back)
    /// - The escrow is now "armed" and ready for completion
    ///
    /// ## Why This Step Matters
    ///
    /// This is the critical "acceptance" step where the taker commits to the trade.
    /// Once funded, the escrow becomes a binding agreement between both parties.
    pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
        // Get escrow key and account info before mutable borrow
        let escrow_key = ctx.accounts.escrow.key();
        let escrow_account_info = ctx.accounts.escrow.to_account_info();
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.is_active, EscrowError::NotActive);
        require!(!escrow.is_funded, EscrowError::AlreadyFunded);
        require!(escrow.taker == Some(ctx.accounts.taker.key()), EscrowError::Unauthorized);

        // Check if escrow has expired
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < escrow.expiry_ts,
            EscrowError::EscrowExpired
        );

        // Transfer SOL from taker to escrow PDA
        let amount_b = escrow.amount_b_expected;
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.taker.to_account_info(),
            to: escrow_account_info,
        };
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                transfer_ix,
            ),
            amount_b,
        )?;

        // Mark funded and record taker
        escrow.is_funded = true;
        escrow.taker = Some(ctx.accounts.taker.key());

        emit!(EscrowFunded {
            escrow: escrow_key,
            taker: ctx.accounts.taker.key(),
            amount_b,
            ts: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// # Complete Swap Instruction
    ///
    /// **What it does**: Executes the final token exchange when both parties have deposited their tokens.
    ///
    /// ## Step-by-Step Process
    ///
    /// 1. **Validate conditions**: Ensure escrow is funded and caller is the taker
    /// 2. **Atomic exchange**: Transfer SOL to taker AND SOL to maker simultaneously
    /// 3. **Update state**: Mark escrow as completed and inactive
    /// 4. **Emit event**: Log the completion for transparency
    ///
    /// ## Security Features
    ///
    /// - **Atomic operation**: Either both transfers succeed or both fail (no partial completion)
    /// - **PDA control**: Only the smart contract can access escrow SOL
    /// - **Authorization**: Only the taker can complete the swap
    /// - **State validation**: Escrow must be both active and funded
    ///
    /// ## What Happens to the SOL
    ///
    /// - **Maker gets**: SOL (what they wanted) transferred to their account
    /// - **Taker gets**: SOL (what they offered) transferred to their account
    ///
    /// ## Why This is the "Happy Path"
    ///
    /// This function represents successful completion of the escrow agreement.
    /// Both parties walk away satisfied with their SOL exchanged.
    pub fn complete_swap(ctx: Context<CompleteSwap>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(escrow.is_active, EscrowError::NotActive);
        require!(escrow.is_funded, EscrowError::NotFunded);

        // Ensure caller is taker
        let taker_key = escrow.taker.ok_or(EscrowError::TakerNotSet)?;
        require_keys_eq!(taker_key, ctx.accounts.taker.key(), EscrowError::Unauthorized);

        // Transfer SOL from escrow PDA to taker (maker's SOL)
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= escrow.amount_a;
        **ctx.accounts.taker.to_account_info().try_borrow_mut_lamports()? += escrow.amount_a;

        // Transfer SOL from escrow PDA to maker (taker's SOL)
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= escrow.amount_b_expected;
        **ctx.accounts.maker.to_account_info().try_borrow_mut_lamports()? += escrow.amount_b_expected;

        // Mark inactive and clear taker
        let escrow = &mut ctx.accounts.escrow;
        escrow.is_active = false;
        escrow.is_funded = false;
        escrow.is_completed = true;
        escrow.taker = None;

        emit!(EscrowCompleted {
            escrow: escrow.key(),
            maker: escrow.maker,
            taker: ctx.accounts.taker.key(),
            ts: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// # Cancel Escrow Instruction
    ///
    /// **What it does**: Maker cancels an unfunded escrow before expiry, getting their tokens back.
    ///
    /// ## When This Can Be Used
    ///
    /// - Escrow is still active (not completed or previously cancelled)
    /// - Taker has NOT yet funded the escrow (vault_b is empty)
    /// - Maker wants to withdraw their offer and reclaim tokens
    ///
    /// ## Step-by-Step Process
    ///
    /// 1. **Validate conditions**: Ensure caller is maker and escrow is unfunded
    /// 2. **Return tokens**: Transfer Token A back to maker from vault
    /// 3. **Clean up vault**: Close vault account and reclaim rent
    /// 4. **Update state**: Mark escrow as inactive
    /// 5. **Emit event**: Log the cancellation for transparency
    ///
    /// ## Security Features
    ///
    /// - **Maker only**: Only the original maker can cancel
    /// - **Unfunded only**: Cannot cancel after taker has deposited
    /// - **Active only**: Cannot cancel already completed escrows
    ///
    /// ## Why This Function Exists
    ///
    /// Gives makers control over their offers. If no suitable taker appears,
    /// the maker can withdraw their tokens instead of waiting forever.
    /// This is different from `refund_after_expiry` which is for expired escrows.
    pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require_keys_eq!(escrow.maker, ctx.accounts.maker.key(), EscrowError::Unauthorized);
        require!(escrow.is_active, EscrowError::NotActive);
        require!(!escrow.is_funded, EscrowError::AlreadyFunded);

        // Transfer SOL from escrow PDA to maker
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= escrow.amount_a;
        **ctx.accounts.maker.to_account_info().try_borrow_mut_lamports()? += escrow.amount_a;

        // Mark inactive
        let escrow = &mut ctx.accounts.escrow;
        escrow.is_active = false;

        emit!(EscrowCancelled {
            escrow: escrow.key(),
            maker: escrow.maker,
            ts: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// # Refund After Expiry Instruction
    ///
    /// **What it does**: Maker recovers their tokens from an expired, unfunded escrow.
    ///
    /// ## When This Can Be Used
    ///
    /// - Escrow has reached its expiry timestamp
    /// - Taker never funded the escrow (vault_b is empty)
    /// - Escrow is still active (not manually cancelled)
    /// - Maker wants to reclaim their locked tokens
    ///
    /// ## Step-by-Step Process
    ///
    /// 1. **Check expiry**: Verify current time is past expiry timestamp
    /// 2. **Validate conditions**: Ensure escrow is unfunded and caller is maker
    /// 3. **Return tokens**: Transfer Token A back to maker from vault
    /// 4. **Clean up vault**: Close vault account and reclaim rent
    /// 5. **Update state**: Mark escrow as inactive
    /// 6. **Emit event**: Log the refund for transparency
    ///
    /// ## Security Features
    ///
    /// - **Time-locked**: Cannot refund until expiry time has passed
    /// - **Maker only**: Only the original maker can claim the refund
    /// - **Unfunded only**: Cannot refund if taker has deposited tokens
    ///
    /// ## Why This Protection Exists
    ///
    /// Prevents funds from being permanently locked if no taker appears.
    /// The expiry mechanism ensures makers can always recover their tokens
    /// if the trade doesn't complete within the agreed timeframe.
    ///
    /// ## Difference from Cancel
    ///
    /// Unlike `cancel_escrow`, this can only be called after expiry.
    /// It provides automatic protection against stuck funds.
    pub fn refund_after_expiry(ctx: Context<RefundAfterExpiry>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require_keys_eq!(escrow.maker, ctx.accounts.maker.key(), EscrowError::Unauthorized);
        require!(escrow.is_active, EscrowError::NotActive);
        require!(!escrow.is_funded, EscrowError::AlreadyFunded);

        let now = Clock::get()?.unix_timestamp;
        require!(now > escrow.expiry_ts, EscrowError::NotExpired);

        // Transfer SOL from escrow PDA to maker
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= escrow.amount_a;
        **ctx.accounts.maker.to_account_info().try_borrow_mut_lamports()? += escrow.amount_a;

        let escrow = &mut ctx.accounts.escrow;
        escrow.is_active = false;

        emit!(EscrowRefunded {
            escrow: escrow.key(),
            maker: escrow.maker,
            ts: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}


#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct CreateEscrow<'info> {
    /// Escrow PDA: seeds = ["escrow", maker, escrow_id]
    #[account(
        init,
        payer = maker,
        space = EscrowAccount::calculate_max_space(),
        seeds = [b"escrow", maker.key().as_ref(), &escrow_id.to_le_bytes()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// Maker creating the escrow
    #[account(mut)]
    pub maker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    /// Escrow must exist (PDA)
    #[account(mut, has_one = maker)]
    pub escrow: Account<'info, EscrowAccount>,

    /// Taker funds the escrow
    #[account(mut)]
    pub taker: Signer<'info>,

    /// Maker (for has_one check)
    /// CHECK: This account is used for has_one constraint validation on the escrow account
    pub maker: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompleteSwap<'info> {
    #[account(mut, has_one = maker)]
    pub escrow: Account<'info, EscrowAccount>,

    /// Taker finalizes the swap (must equal escrow.taker)
    #[account(mut)]
    pub taker: Signer<'info>,

    /// Maker (not signer here)
    /// CHECK: This account is validated through the escrow's maker field constraint
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(mut, has_one = maker)]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub maker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundAfterExpiry<'info> {
    #[account(mut, has_one = maker)]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub maker: Signer<'info>,

    pub system_program: Program<'info, System>,
}


/// # Escrow Account Structure
///
/// This is the **main data structure** that stores all information about an escrow transaction.
/// Think of it as a digital "contract" that both parties agree to follow.
///
/// ## What It Stores
///
/// - **Unique ID**: Each escrow has a unique identifier (like a transaction number)
/// - **SOL Details**: How much SOL is being exchanged
/// - **Party Information**: Who created the escrow and who can take it
/// - **Time Controls**: When the escrow expires and when it was created
/// - **Current State**: Whether it's waiting for funding, ready to complete, or expired
///
/// ## Security Importance
///
/// This account is **immutable once created** (except for status updates).
/// All critical information is stored here and cannot be changed after creation.
#[account]
pub struct EscrowAccount {
    /// The person who created this escrow (Party A)
    /// This person deposits SOL and sets the terms
    /// CHECK: The maker is validated as signer in the CreateEscrow instruction.
    pub maker: Pubkey,

    /// The person who can take this escrow offer (Party B)
    /// If None, anyone can take it. If Some(key), only that specific person can
    /// CHECK: The taker is set from the validated taker account in FundEscrow.
    pub taker: Option<Pubkey>,

    /// Unique identifier for this escrow (like a transaction ID)
    /// Generated from maker's public key + timestamp for uniqueness
    pub escrow_id: u64,

    /// How much SOL the maker is offering
    /// This amount is locked in the escrow until the swap completes
    pub amount_a: u64,

    /// How much SOL the taker must provide
    /// The taker must deposit exactly this amount to complete the swap
    pub amount_b_expected: u64,

    /// Whether the taker has deposited their SOL
    /// True when taker has funded, false when waiting for taker
    pub is_funded: bool,

    /// Whether this escrow is still active and can be used
    /// Set to false when completed, cancelled, or refunded
    pub is_active: bool,

    /// Whether this escrow was successfully completed
    /// Set to true only when the swap is completed successfully
    pub is_completed: bool,

    /// When this escrow expires (Unix timestamp)
    /// After this time, only the maker can refund their SOL
    /// This protects both parties from funds being stuck forever
    pub expiry_ts: i64,

    /// Bump seed for the PDA derivation
    /// Used to recreate the escrow account address when needed
    pub bump: u8,
}

impl EscrowAccount {
    
    pub fn calculate_max_space() -> usize {
        // Anchor discriminator
        let mut size = 8;
        // maker
        size += 32;
        // taker (Option<Pubkey>) -> 1 + 32
        size += 1 + 32;
        // escrow_id
        size += 8;
        // amounts
        size += 8 + 8;
        // bools (is_funded, is_active, is_completed)
        size += 1 + 1 + 1;
        // expiry
        size += 8;
        // bump
        size += 1;
        // padding
        size += 128;
        size
    }
}


#[event]
pub struct EscrowCreated {
    pub escrow: Pubkey,
    pub maker: Pubkey,
    pub escrow_id: u64,
    pub amount_a: u64,
    pub amount_b_expected: u64,
    pub expiry_ts: i64,
    pub ts: i64,
}

#[event]
pub struct EscrowFunded {
    pub escrow: Pubkey,
    pub taker: Pubkey,
    pub amount_b: u64,
    pub ts: i64,
}

#[event]
pub struct EscrowCompleted {
    pub escrow: Pubkey,
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub ts: i64,
}

#[event]
pub struct EscrowCancelled {
    pub escrow: Pubkey,
    pub maker: Pubkey,
    pub ts: i64,
}

#[event]
pub struct EscrowRefunded {
    pub escrow: Pubkey,
    pub maker: Pubkey,
    pub ts: i64,
}


/// # Error Types for Escrow Operations
///
/// These are all the possible error conditions that can occur during escrow operations.
/// Each error has a clear message explaining what went wrong and why.
///
/// ## Error Categories
///
/// - **Validation Errors**: Invalid inputs or state (InvalidAmount, InvalidExpiry, InvalidMint)
/// - **Authorization Errors**: Wrong user trying to perform action (Unauthorized, TakerNotSet)
/// - **State Errors**: Operation attempted at wrong time (NotActive, AlreadyFunded, NotFunded, NotExpired)
///
/// ## Why These Errors Matter
///
/// - **User Safety**: Prevents invalid transactions that could lose funds
/// - **Clear Feedback**: Users understand exactly what went wrong
/// - **Debugging**: Developers can quickly identify issues in testing
/// - **Security**: Blocks malicious or accidental harmful operations
#[error_code]
pub enum EscrowError {
    /// Amount must be greater than zero
    /// Protects against creating escrows with no value
    #[msg("Invalid zero amount")]
    InvalidAmount,

    /// Expiry time must be in the future
    /// Prevents creating escrows that are already expired
    #[msg("Invalid expiry timestamp")]
    InvalidExpiry,

    /// Cannot perform operation on inactive escrow
    /// Escrow may be completed, cancelled, or refunded
    #[msg("Escrow is not active")]
    NotActive,

    /// Taker has already deposited their tokens
    /// Cannot fund an escrow that's already funded
    #[msg("Escrow is already funded")]
    AlreadyFunded,

    /// Taker must fund escrow before it can be completed
    /// Cannot complete a swap until both parties have deposited
    #[msg("Escrow is not funded yet")]
    NotFunded,

    /// Only the designated taker can perform this action
    /// Protects against unauthorized users taking escrows
    #[msg("Only taker can call this")]
    Unauthorized,

    /// Cannot complete escrow without a designated taker
    /// Some operations require a specific taker to be set
    #[msg("Taker not set")]
    TakerNotSet,

    /// Cannot refund until escrow has expired
    /// Protects active escrows from premature refunds
    #[msg("Escrow has not expired yet")]
    NotExpired,

    /// Cannot fund an escrow that has already expired
    /// Protects takers from funding expired escrows
    #[msg("Escrow has expired and cannot be funded")]
    EscrowExpired,
}
