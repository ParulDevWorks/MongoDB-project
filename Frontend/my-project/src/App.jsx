import { useState } from 'react'
import './App.css'
import { Button } from 'antd'
function App() {
  const [isSchedulerStarted, setIsSchedulerStarted] = useState(false);
const startScheduler = () => {
  setIsSchedulerStarted(true);
  fetch('http://localhost:8087/shopify/getBulkProducts', {
    method: 'POST', // Specify the HTTP method
    headers: {
      'Content-Type': 'application/json', // Specify content type
    },
  })
  }
  const stopScheduler = () => {
    setIsSchedulerStarted(false);
  };

  return (
    <>
    <div>
      <h1>Shopify</h1>
      <Button onClick={startScheduler} disabled={isSchedulerStarted}  variant="contained"color="primary">
       Start Scheduler
     </Button>
     <Button onClick={stopScheduler} variant="contained"color="primary">Stop Scheduler</Button>
     </div>
    </>
  )
}

export default App
