import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Download, FileText, TrendingUp, Package, DollarSign } from 'lucide-react';

function Reports() {
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState('week');
  const [periodValue, setPeriodValue] = useState(1);
  const [periodUnit, setPeriodUnit] = useState('weeks');
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});

  const COLORS = ['#1a1a2e', '#16213e', '#0f3460', '#e94560', '#533483'];

  useEffect(() => {
    loadReport();
  }, [reportType, dateRange, periodValue, periodUnit]);

  const getDateRange = () => {
    const today = new Date();
    let startDate;
    
    switch(dateRange) {
      case 'today':
        startDate = today;
        break;
      case 'week':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case 'custom': {
        const safeValue = Math.max(1, parseInt(periodValue || 1, 10));
        startDate = new Date(today);

        if (periodUnit === 'days') {
          startDate.setDate(startDate.getDate() - safeValue);
        } else if (periodUnit === 'weeks') {
          startDate.setDate(startDate.getDate() - (safeValue * 7));
        } else {
          startDate.setMonth(startDate.getMonth() - safeValue);
        }
        break;
      }
      default:
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    return startDate.toISOString().split('T')[0];
  };

  const loadReport = async () => {
    const startDate = getDateRange();
    
    try {
      if (reportType === 'sales') {
        const result = await window.electronAPI.db.all(
          `SELECT DATE(created_at) as date, 
                  SUM(total_amount) as total,
                  COUNT(*) as transactions,
                  SUM(CASE WHEN type = 'in' THEN total_amount ELSE 0 END) as stock_in_value,
                  SUM(CASE WHEN type = 'out' THEN total_amount ELSE 0 END) as stock_out_value
           FROM transactions 
           WHERE created_at >= ?
           GROUP BY DATE(created_at)
           ORDER BY date`,
          [startDate]
        );
        setData(result);
        
        const sum = await window.electronAPI.db.get(
          `SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN type = 'out' THEN total_amount ELSE 0 END), 0) as sales,
            COALESCE(SUM(CASE WHEN type = 'in' THEN total_amount ELSE 0 END), 0) as purchases,
            COUNT(*) as total_transactions
           FROM transactions 
           WHERE created_at >= ?`,
          [startDate]
        );
        setSummary(sum);
        
      } else if (reportType === 'inventory') {
        const result = await window.electronAPI.db.all(
          `SELECT 
            category,
            COUNT(*) as product_count,
            SUM(quantity) as total_quantity,
            SUM(quantity * cost_price) as total_value
           FROM products
           WHERE category IS NOT NULL AND category != ''
           GROUP BY category`
        );
        setData(result);
        
        const sum = await window.electronAPI.db.get(
          `SELECT 
            COUNT(*) as total_products,
            SUM(quantity) as total_items,
            SUM(quantity * cost_price) as total_value,
            SUM(quantity * selling_price) as potential_revenue
           FROM products`
        );
        setSummary(sum);
        
      } else if (reportType === 'products') {
        const result = await window.electronAPI.db.all(
          `SELECT 
            p.name,
            p.sku,
            COUNT(t.id) as transaction_count,
            SUM(CASE WHEN t.type = 'out' THEN t.quantity ELSE 0 END) as units_sold,
            SUM(CASE WHEN t.type = 'out' THEN t.total_amount ELSE 0 END) as revenue
           FROM products p
           LEFT JOIN transactions t ON p.id = t.product_id AND t.created_at >= ?
           GROUP BY p.id
           ORDER BY revenue DESC
           LIMIT 20`,
          [startDate]
        );
        setData(result);
        
        const sum = await window.electronAPI.db.get(
          `SELECT 
            COUNT(DISTINCT p.id) as products_with_sales,
            SUM(t.total_amount) as total_revenue
           FROM products p
           JOIN transactions t ON p.id = t.product_id
           WHERE t.created_at >= ? AND t.type = 'out'`,
          [startDate]
        );
        setSummary(sum);
      }
    } catch (err) {
      console.error('Error loading report:', err);
    }
  };

  const exportReport = () => {
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const renderChart = () => {
    if (reportType === 'sales') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="stock_out_value" name="Sales (Out)" fill="#10b981" />
            <Bar dataKey="stock_in_value" name="Purchases (In)" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (reportType === 'inventory') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="total_value"
              nameKey="category"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2><FileText size={20} /> Reports</h2>
          <div className="report-controls">
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              className="report-control"
              style={{ appearance: 'auto' }}
            >
              <option value="sales">Sales Report</option>
              <option value="inventory">Inventory by Category</option>
              <option value="products">Top Products</option>
            </select>
            
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="report-control"
              style={{ appearance: 'auto' }}
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Period</option>
            </select>

            {dateRange === 'custom' && (
              <>
                <input
                  type="number"
                  min="1"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  className="report-control report-period-input"
                  aria-label="Period value"
                />
                <select
                  value={periodUnit}
                  onChange={(e) => setPeriodUnit(e.target.value)}
                  className="report-control"
                  style={{ appearance: 'auto' }}
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </>
            )}
            
            <button className="btn btn-primary" onClick={exportReport}>
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="stats-grid" style={{ marginTop: '20px' }}>
          {reportType === 'sales' && (
            <>
              <div className="stat-card">
                <h3>Total Revenue</h3>
                <div className="value">${(summary.sales || 0).toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <h3>Total Purchases</h3>
                <div className="value">${(summary.purchases || 0).toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <h3>Transactions</h3>
                <div className="value">{summary.total_transactions || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Net Profit</h3>
                <div className="value" style={{ color: (summary.sales - summary.purchases) >= 0 ? '#10b981' : '#ef4444' }}>
                  ${((summary.sales || 0) - (summary.purchases || 0)).toFixed(2)}
                </div>
              </div>
            </>
          )}
          
          {reportType === 'inventory' && (
            <>
              <div className="stat-card">
                <h3>Total Products</h3>
                <div className="value">{summary.total_products || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Total Items</h3>
                <div className="value">{summary.total_items || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Inventory Value</h3>
                <div className="value">${(summary.total_value || 0).toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <h3>Potential Revenue</h3>
                <div className="value">${(summary.potential_revenue || 0).toFixed(2)}</div>
              </div>
            </>
          )}
          
          {reportType === 'products' && (
            <>
              <div className="stat-card">
                <h3>Products Sold</h3>
                <div className="value">{summary.products_with_sales || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Total Revenue</h3>
                <div className="value">${(summary.total_revenue || 0).toFixed(2)}</div>
              </div>
            </>
          )}
        </div>

        {/* Chart */}
        {data.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ marginBottom: '16px' }}>
              {reportType === 'sales' ? 'Sales vs Purchases' : 'Inventory Distribution'}
            </h3>
            {renderChart()}
          </div>
        )}

        {/* Data Table */}
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ marginBottom: '16px' }}>Detailed Data</h3>
          <table>
            <thead>
              <tr>
                {reportType === 'sales' && (
                  <>
                    <th>Date</th>
                    <th>Transactions</th>
                    <th>Sales (Out)</th>
                    <th>Purchases (In)</th>
                    <th>Net</th>
                  </>
                )}
                {reportType === 'inventory' && (
                  <>
                    <th>Category</th>
                    <th>Products</th>
                    <th>Total Quantity</th>
                    <th>Total Value</th>
                    <th>% of Value</th>
                  </>
                )}
                {reportType === 'products' && (
                  <>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Transactions</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {reportType === 'sales' && data.map((row, i) => (
                <tr key={i}>
                  <td>{row.date}</td>
                  <td>{row.transactions}</td>
                  <td>${(row.stock_out_value || 0).toFixed(2)}</td>
                  <td>${(row.stock_in_value || 0).toFixed(2)}</td>
                  <td>${((row.stock_out_value || 0) - (row.stock_in_value || 0)).toFixed(2)}</td>
                </tr>
              ))}
              {reportType === 'inventory' && data.map((row, i) => {
                const totalVal = data.reduce((sum, r) => sum + (r.total_value || 0), 0);
                return (
                  <tr key={i}>
                    <td>{row.category}</td>
                    <td>{row.product_count}</td>
                    <td>{row.total_quantity}</td>
                    <td>${(row.total_value || 0).toFixed(2)}</td>
                    <td>{totalVal > 0 ? ((row.total_value / totalVal) * 100).toFixed(1) : 0}%</td>
                  </tr>
                );
              })}
              {reportType === 'products' && data.map((row, i) => (
                <tr key={i}>
                  <td>{row.name}</td>
                  <td>{row.sku}</td>
                  <td>{row.transaction_count}</td>
                  <td>{row.units_sold || 0}</td>
                  <td>${(row.revenue || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Reports;
