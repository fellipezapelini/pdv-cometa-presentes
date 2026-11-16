export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: 24, gap: 16, flexWrap: 'wrap',
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}
