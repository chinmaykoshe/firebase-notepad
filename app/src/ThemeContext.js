import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from './theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const [username, setUsernameState] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const themeVal = await AsyncStorage.getItem('notepad-theme');
        if (themeVal === 'light') setIsDark(false);

        const userVal = await AsyncStorage.getItem('notepad-username');
        if (userVal) {
          setUsernameState(userVal);
        } else {
          const osName = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
          const newName = `${osName}_User_${Math.floor(Math.random() * 10000)}`;
          setUsernameState(newName);
          await AsyncStorage.setItem('notepad-username', newName);
        }
      } catch (e) {
        console.log('Storage Error:', e);
      }
    };
    loadData();
  }, []);

  const toggleTheme = async () => {
    try {
      const next = !isDark;
      setIsDark(next);
      await AsyncStorage.setItem('notepad-theme', next ? 'dark' : 'light');
    } catch (e) {}
  };

  const setUsername = async (newName) => {
    try {
      setUsernameState(newName);
      await AsyncStorage.setItem('notepad-username', newName);
    } catch (e) {}
  };

  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, username, setUsername }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
