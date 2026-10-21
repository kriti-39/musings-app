import { RiCheckLine } from 'react-icons/ri'
import { useTheme } from '../../context/ThemeContext'

// ─── Choose how the app looks ────────────────────────────────────────────────
// Three complete looks plus "match my phone". Each option previews itself —
// the swatches are the theme's own ground, fill and accent, so you can tell
// them apart before committing, and the chosen one is marked with a tick
// rather than colour alone.
export default function ThemePicker() {
  const { choice, active, setTheme, themes } = useTheme()

  // With a single look there is no choice to offer, and a one-option list is
  // just clutter. Hides itself until a second theme exists.
  if (themes.length < 2) return null

  const options = [
    {
      id: 'system',
      name: 'Match my phone',
      blurb: 'Light during the day, Riyaz at night.',
      swatch: ['#FAFAF8', '#100E1C', '#F0B855'],
    },
    ...themes,
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-800">Appearance</h2>
      <p className="text-xs text-gray-400 mt-1">
        Applies to this device only.
      </p>

      <div className="mt-4 space-y-2">
        {options.map(o => {
          const picked = choice === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setTheme(o.id)}
              aria-pressed={picked}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors ${
                picked ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-200'
              }`}
            >
              {/* The theme showing itself, rather than a name and a guess */}
              <span className="shrink-0 flex rounded-lg overflow-hidden border border-gray-200">
                {o.swatch.map((c, i) => (
                  <span key={i} className="block w-4 h-9" style={{ background: c }} />
                ))}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-800">
                  {o.name}
                  {o.id === 'system' && choice === 'system' && (
                    <span className="font-normal text-gray-400">
                      {' '}· {themes.find(t => t.id === active)?.name} right now
                    </span>
                  )}
                </span>
                <span className="block text-xs text-gray-400 mt-0.5">{o.blurb}</span>
              </span>

              {picked && <RiCheckLine size={18} className="shrink-0 text-amber-600" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
