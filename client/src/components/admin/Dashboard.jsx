function Dashboard() {
  return (
    <div>
      <h1 style={{ marginBottom: '20px' }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>Total Customers</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>0</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>Active Stays</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>0</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>Unpaid Bills</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>$0.00</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>Monthly Revenue</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>$0.00</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
