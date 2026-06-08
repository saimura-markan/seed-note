import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [companies, setCompanies] = useState([])
  const [sites, setSites] = useState([])
  const [orders, setOrders] = useState([])
  const [dbStatus, setDbStatus] = useState({
    companies: { loading: true },
    sites: { loading: true },
    orders: { loading: true },
  })
  const [loaded, setLoaded] = useState(false)

  const loadData = useCallback(async () => {
    setLoaded(false)
    const fetchTable = async (table, setter, key) => {
      setDbStatus(prev => ({ ...prev, [key]: { loading: true } }))
      const { data, error } = await supabase.from(table).select('*').limit(500)
      if (error) {
        setDbStatus(prev => ({ ...prev, [key]: { loading: false, error: error.message } }))
      } else {
        setter(data || [])
        setDbStatus(prev => ({ ...prev, [key]: { loading: false, count: data?.length ?? 0 } }))
      }
    }
    await Promise.all([
      fetchTable('companies', setCompanies, 'companies'),
      fetchTable('sites', setSites, 'sites'),
      fetchTable('orders', setOrders, 'orders'),
    ])
    setLoaded(true)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  return (
    <DataContext.Provider value={{ companies, sites, orders, dbStatus, loaded, refresh: loadData }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
