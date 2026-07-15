/** Theme constants for dark/light mode — mirrors the mockup's premium CSS/design guidelines */
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isSmall = width <= 375;

export const Colors = {
  dark: {
    bg: '#000000',
    text: '#ffffff',
    textMuted: '#999999',
    panelBg: '#111111',
    inputBg: '#222222',
    inputBorder: '#333333',
    accent: '#ffffff',
    accentText: '#000000',
    accentHover: '#cccccc',
    hoverBg: '#222222',
    danger: '#ffffff',
    dangerHover: '#cccccc',
    success: '#ffffff',
    info: '#ffffff',
    statusOpen: '#ffffff',
    statusProtected: '#ffffff',
    placeholder: '#666666',
    shadow: 'rgba(0,0,0,0.6)',
    overlay: 'rgba(0,0,0,0.7)',
    noteBorders: ['#ffffff', '#cccccc', '#999999', '#666666'],
    noteFolderBgs: ['rgba(255,255,255,0.1)', 'rgba(200,200,200,0.1)', 'rgba(150,150,150,0.1)', 'rgba(100,100,100,0.1)'],
    pinnedCardBgs: ['#111111', '#1a1a1a', '#222222', '#2a2a2a'],
    pinnedCardTexts: ['#ffffff', '#eeeeee', '#dddddd', '#cccccc'],
    pinnedBg: 'rgba(255,255,255,0.08)',
    tagChipBg: 'rgba(255,255,255,0.18)',
    tagChipText: '#ffffff',
    toastBg: '#222222',
    toastText: '#ffffff',
    expiryDanger: '#ffffff',
    expiryWarn: '#cccccc',
    expiryOk: '#999999',
    cardShadow: 'rgba(0,0,0,0.4)',
    tabBarActive: '#ffffff',
    tabBarInactive: '#666666',
    tabBarBg: '#000000',
    statsCards: {
      notes: { bg: 'rgba(255,255,255,0.12)', icon: '#ffffff' },
      favorites: { bg: 'rgba(255,255,255,0.1)', icon: '#dddddd' },
      categories: { bg: 'rgba(255,255,255,0.08)', icon: '#bbbbbb' }
    }
  },
  light: {
    bg: '#ffffff',
    text: '#000000',
    textMuted: '#666666',
    panelBg: '#f9f9f9',
    inputBg: '#eeeeee',
    inputBorder: '#dddddd',
    accent: '#000000',
    accentText: '#ffffff',
    accentHover: '#333333',
    hoverBg: '#e5e5e5',
    danger: '#000000',
    dangerHover: '#333333',
    success: '#000000',
    info: '#000000',
    statusOpen: '#000000',
    statusProtected: '#000000',
    placeholder: '#999999',
    shadow: 'rgba(0,0,0,0.06)',
    overlay: 'rgba(0,0,0,0.4)',
    noteBorders: ['#000000', '#333333', '#666666', '#999999'],
    noteFolderBgs: ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.12)'],
    pinnedCardBgs: ['#f0f0f0', '#e8e8e8', '#e0e0e0', '#d8d8d8'],
    pinnedCardTexts: ['#000000', '#111111', '#222222', '#333333'],
    pinnedBg: 'rgba(0,0,0,0.05)',
    tagChipBg: 'rgba(0,0,0,0.1)',
    tagChipText: '#000000',
    toastBg: '#000000',
    toastText: '#ffffff',
    expiryDanger: '#000000',
    expiryWarn: '#333333',
    expiryOk: '#666666',
    cardShadow: 'rgba(0,0,0,0.05)',
    tabBarActive: '#000000',
    tabBarInactive: '#999999',
    tabBarBg: '#ffffff',
    statsCards: {
      notes: { bg: '#f0f0f0', icon: '#000000' },
      favorites: { bg: '#e8e8e8', icon: '#222222' },
      categories: { bg: '#e0e0e0', icon: '#444444' }
    }
  },
};

export const Spacing = {
  xs: isSmall ? 2 : 4,
  sm: isSmall ? 6 : 8,
  md: isSmall ? 10 : 12,
  lg: isSmall ? 14 : 16,
  xl: isSmall ? 16 : 20,
  xxl: isSmall ? 20 : 24,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: isSmall ? 10 : 11,
  sm: isSmall ? 12 : 13,
  base: isSmall ? 14 : 15,
  md: isSmall ? 15 : 17,
  lg: isSmall ? 18 : 20,
  xl: isSmall ? 20 : 24,
  xxl: isSmall ? 26 : 32,
};
