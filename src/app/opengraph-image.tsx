import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Dhun (धुन) — Daily Indian Music Guessing Game';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#080c14',
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(245, 158, 11, 0.15), transparent 70%)',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          padding: '40px',
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '16px' }}>
          <span style={{ fontSize: '72px' }}>🪕</span>
          <span
            style={{
              fontSize: '84px',
              fontWeight: 900,
              letterSpacing: '-2px',
              background: 'linear-gradient(90deg, #fbbf24, #f97316, #fde68a)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            DHUN धुन
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '28px',
            color: '#94a3b8',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '40px',
          }}
        >
          Daily Indian Music Guessing Game
        </div>

        {/* Visualizer Mockup */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            width: '800px',
            height: '24px',
            marginBottom: '40px',
          }}
        >
          <div style={{ flex: 1, backgroundColor: '#10b981', borderRadius: '6px' }} />
          <div style={{ flex: 2, backgroundColor: '#334155', borderRadius: '6px' }} />
          <div style={{ flex: 3, backgroundColor: '#334155', borderRadius: '6px' }} />
          <div style={{ flex: 5, backgroundColor: '#334155', borderRadius: '6px' }} />
          <div style={{ flex: 8, backgroundColor: '#334155', borderRadius: '6px' }} />
          <div style={{ flex: 15, backgroundColor: '#334155', borderRadius: '6px' }} />
        </div>

        {/* Feature Pills */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '20px', color: '#cbd5e1' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '10px 24px', borderRadius: '999px', border: '1px solid #334155' }}>
            🎵 6 Progressive Audio Snippets
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '10px 24px', borderRadius: '999px', border: '1px solid #334155' }}>
            🇮🇳 Bollywood • Indie • Regional
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '10px 24px', borderRadius: '999px', border: '1px solid #334155' }}>
            ⚡ Instant Hinglish Autocomplete
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
