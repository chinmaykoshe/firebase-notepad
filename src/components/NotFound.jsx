import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      textAlign: 'center',
      backgroundColor: 'var(--bg, #1a1a1a)',
      color: 'var(--text-main, #e0e0e0)',
      fontFamily: 'Inter, sans-serif'
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
      <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Page Not Found</h2>
      <p style={{ marginBottom: '2rem' }}>The page or note you are looking for does not exist or has been moved.</p>
      <Link 
        to="/" 
        style={{
          padding: '10px 20px',
          backgroundColor: '#3498db',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '5px',
          fontWeight: 'bold'
        }}
      >
        Return to Home
      </Link>
    </div>
  );
}
