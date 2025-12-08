function BillView({ billCode }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h1>Invoice</h1>
      <p style={{ color: '#666', marginTop: '10px' }}>Bill Code: {billCode}</p>
      <p style={{ marginTop: '20px' }}>Bill details will appear here...</p>
    </div>
  )
}

export default BillView
