import { useState, useEffect } from 'react'
import { themes } from '../../themes'
import './ThemeSwitcher.css'

function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('appTheme') || 'pink'
  })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Apply theme to CSS variables
    const theme = themes[currentTheme]
    const root = document.documentElement
    root.style.setProperty('--theme-gradient', theme.gradient)
    root.style.setProperty('--theme-gradient-vertical', theme.gradientVertical)
    root.style.setProperty('--theme-primary', theme.primary)
    root.style.setProperty('--theme-secondary', theme.secondary)
    root.style.setProperty('--theme-shadow', theme.shadow)
    root.style.setProperty('--theme-shadow-hover', theme.shadowHover)
    root.style.setProperty('--theme-focus', theme.focus)

    // Save to localStorage
    localStorage.setItem('appTheme', currentTheme)
  }, [currentTheme])

  return (
    <div className="theme-switcher">
      <button
        className="theme-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Change theme"
      >
        🎨 Theme
      </button>

      {isOpen && (
        <div className="theme-switcher-dropdown">
          <div className="theme-switcher-header">
            Choose a color theme
          </div>
          <div className="theme-options">
            {Object.keys(themes).map((themeKey) => (
              <button
                key={themeKey}
                className={`theme-option ${currentTheme === themeKey ? 'active' : ''}`}
                onClick={() => {
                  setCurrentTheme(themeKey)
                  setIsOpen(false)
                }}
              >
                <div
                  className="theme-preview"
                  style={{ background: themes[themeKey].gradient }}
                />
                <span>{themes[themeKey].name}</span>
                {currentTheme === themeKey && <span className="checkmark">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ThemeSwitcher
