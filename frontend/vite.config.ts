import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// NOTE: the project path C:\Project#2 contains a "#", which Vite/rolldown (v8)
// reads as a URL fragment and chokes on. Run the dev server from the "#"-free
// subst drive instead: `subst V: C:\Project#2` then `cd /v/frontend && npm run dev`.
// (subst is a device mapping that Node's realpath does NOT resolve back to the
// "#" path, unlike a junction.) No path overrides needed here.

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
