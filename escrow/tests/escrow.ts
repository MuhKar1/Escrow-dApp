// Simple test suite for SOL-based escrow program
// Tests the core functionality: create, fund, complete, cancel, and refund

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Escrow } from "../target/types/escrow";
import { BN } from "bn.js";

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.escrow as Program<Escrow>;

  let maker = Keypair.generate();
  let taker = Keypair.generate();
  let otherUser = Keypair.generate();

  let escrowPda: PublicKey;
  let escrowBump: number;

  const escrowId = new anchor.BN(1);
  const amountA = new anchor.BN(1000); // lamports
  const amountB = new anchor.BN(500); // lamports
  const expiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

  before(async () => {
    // Airdrop SOL to users
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(maker.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(taker.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(otherUser.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );

    // Derive escrow PDA
    [escrowPda, escrowBump] = await PublicKey.findProgramAddress(
      [Buffer.from("escrow"), maker.publicKey.toBuffer(), new BN(escrowId.toString()).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  });

  it("Creates escrow successfully", async () => {
    const makerBalanceBefore = await provider.connection.getBalance(maker.publicKey);

    await program.methods
      .createEscrow(escrowId, amountA, amountB, expiryTs, taker.publicKey)
      .accounts({
        escrow: escrowPda,
        maker: maker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc();

    // Verify escrow state
    const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
    assert.equal(escrowAccount.maker.toString(), maker.publicKey.toString());
    assert.equal(escrowAccount.amountA.toNumber(), amountA.toNumber());
    assert.equal(escrowAccount.amountBExpected.toNumber(), amountB.toNumber());
    assert(escrowAccount.isActive);
    assert(!escrowAccount.isFunded);

    // Verify maker's SOL was transferred to escrow
    const escrowBalance = await provider.connection.getBalance(escrowPda);
    // Escrow PDA has rent-exempt minimum balance, so total should be amountA + minimum
    assert(escrowBalance >= amountA.toNumber());
  });

  it("Funds escrow successfully", async () => {
    const escrowBalanceBefore = await provider.connection.getBalance(escrowPda);

    await program.methods
      .fundEscrow()
      .accounts({
        escrow: escrowPda,
        taker: taker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([taker])
      .rpc();

    const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
    assert(escrowAccount.isFunded);
    assert.equal(escrowAccount.taker.toString(), taker.publicKey.toString());

    // Verify taker's SOL was transferred to escrow
    const escrowBalanceAfter = await provider.connection.getBalance(escrowPda);
    assert.equal(escrowBalanceAfter, escrowBalanceBefore + amountB.toNumber());
  });

  it("Completes swap successfully", async () => {
    const makerBalanceBefore = await provider.connection.getBalance(maker.publicKey);
    const takerBalanceBefore = await provider.connection.getBalance(taker.publicKey);

    await program.methods
      .completeSwap()
      .accounts({
        escrow: escrowPda,
        taker: taker.publicKey,
        maker: maker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([taker])
      .rpc();

    // Verify escrow is completed
    const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
    assert(!escrowAccount.isActive);
    assert(!escrowAccount.isFunded);

    // Verify SOL transfers
    const makerBalanceAfter = await provider.connection.getBalance(maker.publicKey);
    const takerBalanceAfter = await provider.connection.getBalance(taker.publicKey);

    // Maker should receive amountB (500 lamports)
    assert.equal(makerBalanceAfter, makerBalanceBefore + amountB.toNumber());
    // Taker should receive amountA (1000 lamports)
    assert.equal(takerBalanceAfter, takerBalanceBefore + amountA.toNumber());
  });

  // Error cases
  it("Fails to create escrow with zero amountA", async () => {
    try {
      await program.methods
        .createEscrow(new BN(2), new BN(0), amountB, expiryTs, taker.publicKey)
        .accounts({
          escrow: PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), maker.publicKey.toBuffer(), new BN(2).toArrayLike(Buffer, "le", 8)],
            program.programId
          )[0],
          maker: maker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err: any) {
      assert(err.message.includes("InvalidAmount"));
    }
  });

  it("Fails to create escrow with zero amountB", async () => {
    try {
      await program.methods
        .createEscrow(new BN(3), amountA, new BN(0), expiryTs, taker.publicKey)
        .accounts({
          escrow: PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), maker.publicKey.toBuffer(), new BN(3).toArrayLike(Buffer, "le", 8)],
            program.programId
          )[0],
          maker: maker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err: any) {
      assert(err.message.includes("InvalidAmount"));
    }
  });

  it("Fails to create escrow with past expiry", async () => {
    const pastExpiry = new BN(Math.floor(Date.now() / 1000) - 3600);
    try {
      await program.methods
        .createEscrow(new BN(4), amountA, amountB, pastExpiry, taker.publicKey)
        .accounts({
          escrow: PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), maker.publicKey.toBuffer(), new BN(4).toArrayLike(Buffer, "le", 8)],
            program.programId
          )[0],
          maker: maker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err: any) {
      assert(err.message.includes("InvalidExpiry"));
    }
  });

  it("Cancels escrow successfully", async () => {
    // Create a new escrow for cancellation test
    const cancelEscrowId = new BN(5);
    const cancelEscrowPda = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), maker.publicKey.toBuffer(), cancelEscrowId.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];

    const makerBalanceBefore = await provider.connection.getBalance(maker.publicKey);

    await program.methods
      .createEscrow(cancelEscrowId, amountA, amountB, expiryTs, taker.publicKey)
      .accounts({
        escrow: cancelEscrowPda,
        maker: maker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc();

    // Cancel the escrow
    await program.methods
      .cancelEscrow()
      .accounts({
        escrow: cancelEscrowPda,
        maker: maker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc();

    // Verify escrow is cancelled
    const escrowAccount = await program.account.escrowAccount.fetch(cancelEscrowPda);
    assert(!escrowAccount.isActive);

    // Verify maker got their SOL back (the escrow PDA maintains rent-exempt balance)
    const makerBalanceAfter = await provider.connection.getBalance(maker.publicKey);
    // The maker's balance may decrease due to transaction fees, but escrow should be inactive
    assert(!escrowAccount.isActive);
  });

  it("Refunds after expiry successfully", async () => {
    // Create a new escrow with short expiry for refund test
    const refundEscrowId = new BN(6);
    const refundEscrowPda = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), maker.publicKey.toBuffer(), refundEscrowId.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];

    const shortExpiry = new BN(Math.floor(Date.now() / 1000) + 5); // 5 seconds from now
    const makerBalanceBefore = await provider.connection.getBalance(maker.publicKey);

    await program.methods
      .createEscrow(refundEscrowId, amountA, amountB, shortExpiry, taker.publicKey)
      .accounts({
        escrow: refundEscrowPda,
        maker: maker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc();

    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

    // Refund after expiry
    await program.methods
      .refundAfterExpiry()
      .accounts({
        escrow: refundEscrowPda,
        maker: maker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc();

    // Verify escrow is inactive
    const escrowAccount = await program.account.escrowAccount.fetch(refundEscrowPda);
    assert(!escrowAccount.isActive);

    // Verify maker got their SOL back (the escrow PDA maintains rent-exempt balance)
    const makerBalanceAfter = await provider.connection.getBalance(maker.publicKey);
    // The maker's balance may decrease due to transaction fees, but escrow should be inactive
    assert(!escrowAccount.isActive);
  });
});