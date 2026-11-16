export default function StatCard({ label, value, sub, color = 'var(--brand)', icon: Icon }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {Icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} color={color} />
        </div>
      )}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Syne', marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}
