import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

// Three complete looks, not a palette crossed with a light/dark switch.
// Not exported — consumers get it from the context as `themes`, which keeps
// this file exporting components only.
const THEMES = [
  {
    id: 'light',
    name: 'Light',
    blurb: 'Warm paper. Easiest to read in daylight.',
    dark: false,
    swatch: ['#FAFAF8', '#B4531A', '#E07A2E'],
  },
  {
    id: 'riyaz',
    name: 'Riyaz',
    blurb: 'The practice before dawn — indigo and marigold.',
    dark: true,
    swatch: ['#100E1C', '#5A4CC4', '#F0B855'],
  },
  {
    id: 'kaanch',
    name: 'Kaanch',
    blurb: 'Glass. Almost no colour, and saffron where it counts.',
    dark: true,
    swatch: ['#0D0D0B', '#F4F3EE', '#F0914A'],
  },
]

const IDS = THEMES.map(t => t.id)
const isDark = (id) => THEMES.find(t => t.id === id)?.dark === true

// 'system' follows the phone: Light by day, Riyaz at night. Anything else is
// a deliberate choice and is kept.
const STORED = 'theme'

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'riyaz' : 'light'
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
