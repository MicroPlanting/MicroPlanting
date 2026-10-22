import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Set VITE_BASE=/your-repo-name/ for GitHub Pages
export default defineConfig({ base: process.env.VITE_BASE || './', plugins: [react()] })
