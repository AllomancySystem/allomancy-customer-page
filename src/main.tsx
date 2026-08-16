import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { captureTokenFromFragment } from './auth/token.ts'

// Capture the customer token from the URL fragment ONCE, at app init — BEFORE React
// and the router mount. The frozen helper persists it to sessionStorage and scrubs
// the fragment. Routing is path-based, so the token never rides a route/URL.
captureTokenFromFragment()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
