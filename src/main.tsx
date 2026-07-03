import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TemperamentClock from './TemperamentClock.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TemperamentClock />
  </StrictMode>,
)
