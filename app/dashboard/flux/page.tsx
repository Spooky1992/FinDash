export default function FluxPage() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0c0c11', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: 'oklch(63% 0.19 250)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: '#fff',
      }}>F</div>
      <div style={{ color: '#e8e8f2', fontSize: 20, fontWeight: 700 }}>FinDash</div>
      <div style={{ color: '#636385', fontSize: 14 }}>
        Infrastructure prête — migration des pages en cours.
      </div>
    </div>
  )
}