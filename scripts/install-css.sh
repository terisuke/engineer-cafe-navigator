#!/bin/bash
echo "Installing Tailwind CSS v3 dependencies..."
pnpm remove -D tailwindcss postcss autoprefixer 2>/dev/null
pnpm add -D tailwindcss@3.4.14 postcss@8.4.47 autoprefixer@10.4.20
echo "Cleaning caches..."
rm -rf .next node_modules/.cache
echo "CSS dependencies installed successfully!"