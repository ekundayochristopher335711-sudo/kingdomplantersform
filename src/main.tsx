import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import HomePage from './pages/HomePage'
import { EventContentProvider } from './config/EventContentProvider'
import '@fontsource-variable/figtree'
import './styles.css'

const AdminPage = lazy(() => import('./pages/AdminPage'))
const isAdmin = /^\/admin\/?$/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EventContentProvider>
      {isAdmin ? (
        <Suspense fallback={<main className="container route-loading" aria-busy="true">Loading organizer dashboard…</main>}>
          <AdminPage />
        </Suspense>
      ) : <HomePage />}
    </EventContentProvider>
  </StrictMode>,
)
