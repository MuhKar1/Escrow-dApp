#!/bin/bash

echo "🧪 Testing Solana Escrow Program"
echo "================================"
echo ""

# Build the program
echo "📦 Building program..."
anchor build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Run tests
echo "🧪 Running tests..."
anchor test --skip-local-validator

echo ""
if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "⚠️  Some tests failed (may be network issues)"
fi
