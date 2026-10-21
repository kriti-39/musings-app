import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

// One palette — black, cerulean and neon red — in light and dark. Riyaz and
// Kaanch are parked, not deleted: the token layer takes any number of themes,
// so adding one back is a block of CSS variables and an entry here, with no
// component changes.
//
// Not exported — consumers get it from the context as `themes`, which keeps
// this file exporting components only.
const THEMES = [
  {
    id: 'light',
    name: 'Light',
    blurb: 'Black on paper, cerulean for every action.',
    dark: false,
    swatch: ['#F4F6FA', '#0B82CB', '#FF2D2D'],
  },
  {
    id: 'dark',
    name: 'Dark',
    blurb: 'The same three colours, inverted ground.',
    dark: true,
    swatch: ['#0A0D13', '#56B6F2', '#FF7070'],
  },
]

const IDS = THEMES.map(t => t.id)
const isDark = (id) => THEMES.find(t => t.id === id)?.dark === true

// 'system' follows the phone: Light by day, Riyaz at night. Anything else is
// a deliberate choice and is kept.
const STORED = 'theme'

// With only a light theme available there is nothing to follow the phone to,
// so this returns light until a dark theme comes back.
function systemTheme() {
  const dark = THEMES.find(t => t.dark)
  if (!dark) return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? dark.id : 'light'
}

function readStored() {
  const saved = localStorage.getItem(STORED)
  if (!saved) return 'system'
  if (saved === 'system' || IDS.includes(saved)) return saved
  // Migrating from the old two-way switch, which stored 'dark' or 'light'
  if (saved === 'dark') return 'riyaz'
  return 'system'
}

export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(readStored)

  const active = choice === 'system' ? systemTheme() : choice

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', active)
    // The old dark mode styles key off this class, and plenty of screens still
    // rely on them. Keeping it in sync means the app can be migrated to tokens
    // a screen at a time instead of in one unreviewable rewrite.
    root.classList.toggle('dark', isDark(active))
    // Browser UI — address bar, form controls — follows along.
    root.style.colorScheme = isDark(active) ? 'dark' : 'light'
    localStorage.setItem(STORED, choice)
  }, [choice, active])

  // Follow the phone as it changes, but only while nothing was chosen by hand.
  useEffect(() => {
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setChoice('system')   // re-reads systemTheme()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [choice])

  return (
    <ThemeContext.Provider value={{
      choice, active, setTheme: setChoice, themes: THEMES,
      dark: isDark(active),
      // Kept so the existing header toggles keep working while screens migrate
      toggle: () => setChoice(isDark(active) ? 'light' : 'riyaz'),
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
