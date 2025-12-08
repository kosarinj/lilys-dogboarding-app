import { useParams } from 'react-router-dom'
import BillView from '../components/guest/BillView'

function BillPage() {
  const { billCode } = useParams()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '40px 20px' }}>
      <BillView billCode={billCode} />
    </div>
  )
}

export default BillPage
