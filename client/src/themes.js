// Color themes for the app
export const themes = {
  pink: {
    name: 'Pink',
    gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
    gradientVertical: 'linear-gradient(180deg, #f472b6 0%, #ec4899 100%)',
    primary: '#f472b6',
    secondary: '#ec4899',
    shadow: 'rgba(244, 114, 182, 0.25)',
    shadowHover: 'rgba(244, 114, 182, 0.35)',
    focus: 'rgba(244, 114, 182, 0.1)'
  },
  purple: {
    name: 'Purple',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    gradientVertical: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
    primary: '#667eea',
    secondary: '#764ba2',
    shadow: 'rgba(102, 126, 234, 0.25)',
    shadowHover: 'rgba(102, 126, 234, 0.35)',
    focus: 'rgba(102, 126, 234, 0.1)'
  },
  blue: {
    name: 'Ocean Blue',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    gradientVertical: 'linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)',
    primary: '#4facfe',
    secondary: '#00f2fe',
    shadow: 'rgba(79, 172, 254, 0.25)',
    shadowHover: 'rgba(79, 172, 254, 0.35)',
    focus: 'rgba(79, 172, 254, 0.1)'
  },
  green: {
    name: 'Fresh Green',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    gradientVertical: 'linear-gradient(180deg, #43e97b 0%, #38f9d7 100%)',
    primary: '#43e97b',
    secondary: '#38f9d7',
    shadow: 'rgba(67, 233, 123, 0.25)',
    shadowHover: 'rgba(67, 233, 123, 0.35)',
    focus: 'rgba(67, 233, 123, 0.1)'
  },
  orange: {
    name: 'Sunset Orange',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    gradientVertical: 'linear-gradient(180deg, #fa709a 0%, #fee140 100%)',
    primary: '#fa709a',
    secondary: '#fee140',
    shadow: 'rgba(250, 112, 154, 0.25)',
    shadowHover: 'rgba(250, 112, 154, 0.35)',
    focus: 'rgba(250, 112, 154, 0.1)'
  },
  teal: {
    name: 'Mint Teal',
    gradient: 'linear-gradient(135deg, #3eadcf 0%, #abe9cd 100%)',
    gradientVertical: 'linear-gradient(180deg, #3eadcf 0%, #abe9cd 100%)',
    primary: '#3eadcf',
    secondary: '#abe9cd',
    shadow: 'rgba(62, 173, 207, 0.25)',
    shadowHover: 'rgba(62, 173, 207, 0.35)',
    focus: 'rgba(62, 173, 207, 0.1)'
  }
}

export const getTheme = (themeName) => themes[themeName] || themes.teal
