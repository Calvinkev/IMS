import React, { useState, useEffect } from 'react';
import { 
  Package, ShoppingCart, Search, LogOut, Box, History
} from 'lucide-react';

function StaffDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);

  const [saleForm, setSaleForm] = useState({
    quantity: '',
    unit_price: '',
    notes: ''
  });

  useEffect(() => {
    loadProducts();
    loadRecentTransactions();
  }, []);

  const loadProducts = async () => {
    try {
      const result = await window.electronAPI.db.all(
        'SELECT * FROM products ORDER BY name ASC'
      );
      setProducts(result);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      const result = await window.electronAPI.db.all(
        `SELECT t.*, p.name as product_name 
         FROM transactions t 
         JOIN products p ON t.product_id = p.id 
         WHERE t.type = 'out'
         ORDER BY t.created_at DESC 
         LIMIT 50`
      );
      setRecentTransactions(result);
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  };

  const handleSaleOperation = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      const qty = parseInt(saleForm.quantity, 10);
      if (!qty || qty <= 0) {
        alert('Enter a valid quantity.');
        return;
      }

      const newQty = selectedProduct.quantity - qty;

      if (newQty < 0) {
        alert('Insufficient stock!');
        return;
      }

      // Update product quantity
      await window.electronAPI.db.run(
        'UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQty, selectedProduct.id]
      );

      const unitPrice = parseFloat(saleForm.unit_price || selectedProduct.selling_price || 0);
      const totalAmount = qty * unitPrice;
      
      await window.electronAPI.db.run(
        `INSERT INTO transactions (product_id, type, quantity, unit_price, total_amount, notes, user_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [selectedProduct.id, 'out', qty, unitPrice, totalAmount, saleForm.notes, user.id]
      );

      setShowSaleModal(false);
      setSaleForm({ quantity: '', unit_price: '', notes: '' });
      setSelectedProduct(null);
      loadProducts();
      loadRecentTransactions();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const openSaleModal = (product) => {
    setSelectedProduct(product);
    setSaleForm({
      quantity: '',
      unit_price: product.selling_price || '',
      notes: ''
    });
    setShowSaleModal(true);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const lowStockCount = products.filter(p => p.quantity <= p.min_stock).length;
  const availableProductsCount = products.filter(p => p.quantity > 0).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;

  return (
    <div className="app staff-app">
      <aside className="sidebar staff-sidebar">
        <h1 className="staff-brand"><Package size={24} /> Shop IMS</h1>
        <nav className="staff-nav">
          <a 
            href="#products" 
            className={activeTab === 'products' ? 'active' : ''}
            onClick={() => setActiveTab('products')}
          >
            <Box size={20} /> Products
          </a>
          <a 
            href="#transactions" 
            className={activeTab === 'transactions' ? 'active' : ''}
            onClick={() => setActiveTab('transactions')}
          >
            <History size={20} /> Transactions
          </a>
        </nav>
        <div className="staff-user-wrap">
          <div className="staff-user-panel">
            <p className="staff-user-caption">Logged in as</p>
            <p className="staff-user-name">{user.fullName}</p>
            <p className="staff-user-role">{user.role}</p>
          </div>
          <button className="btn btn-secondary staff-logout-btn" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content staff-main-content">
        {activeTab === 'products' && (
          <>
            <div className="stats-grid staff-stats-grid">
              <div className="stat-card staff-stat-card">
                <h3>Total Product Lines</h3>
                <div className="value">{products.length}</div>
              </div>
              <div className="stat-card staff-stat-card">
                <h3>Available Products</h3>
                <div className="value" style={{ color: '#0f766e' }}>
                  {availableProductsCount}
                </div>
              </div>
              <div className="stat-card staff-stat-card">
                <h3>Low Stock Items</h3>
                <div className="value" style={{ color: lowStockCount > 0 ? '#ef4444' : '#10b981' }}>
                  {lowStockCount}
                </div>
              </div>
              <div className="stat-card staff-stat-card">
                <h3>Out Of Stock</h3>
                <div className="value" style={{ color: outOfStockCount > 0 ? '#b91c1c' : '#1d4ed8' }}>
                  {outOfStockCount}
                </div>
              </div>
            </div>

            <div className="card staff-card">
              <div className="card-header staff-card-header">
                <h2>Products</h2>
              </div>

              <div className="search-box staff-search-box">
                <input
                  className="staff-search-input"
                  type="text"
                  placeholder="Search by name, SKU, or barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className="btn btn-secondary staff-search-btn">
                  <Search size={16} /> Search
                </button>
              </div>

              <table className="staff-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id}>
                      <td>{product.sku}</td>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>
                        <span className={`status-badge ${product.quantity <= product.min_stock ? 'status-low' : 'status-ok'}`}>
                          {product.quantity} {product.unit}
                        </span>
                      </td>
                      <td>${product.selling_price}</td>
                      <td>
                        <button 
                          className="btn btn-danger staff-sell-btn"
                          style={{ padding: '6px 12px' }}
                          onClick={() => openSaleModal(product)}
                        >
                          <ShoppingCart size={14} /> Sell
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <div className="card staff-card">
            <div className="card-header staff-card-header">
              <h2>Recent Sales</h2>
            </div>
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.created_at).toLocaleString()}</td>
                    <td>{tx.product_name}</td>
                    <td>
                      <span className="status-badge status-low">
                        Sale
                      </span>
                    </td>
                    <td>{tx.quantity}</td>
                    <td>${tx.unit_price}</td>
                    <td>${tx.total_amount}</td>
                    <td>{tx.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Sale Modal */}
      {showSaleModal && selectedProduct && (
        <div className="modal-overlay staff-modal-overlay" onClick={() => setShowSaleModal(false)}>
          <div className="modal staff-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header staff-modal-header">
              <h3>Record Sale - {selectedProduct.name}</h3>
              <button className="close-btn" onClick={() => setShowSaleModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaleOperation}>
              <div className="staff-sale-info" style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px' }}>
                <p><strong>Current Stock:</strong> {selectedProduct.quantity} {selectedProduct.unit}</p>
                <p><strong>SKU:</strong> {selectedProduct.sku}</p>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity *</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={saleForm.quantity}
                    onChange={e => setSaleForm({...saleForm, quantity: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Selling Price</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder={selectedProduct.selling_price}
                  value={saleForm.unit_price}
                  onChange={e => setSaleForm({...saleForm, unit_price: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  rows="2"
                  placeholder="e.g., Customer name, receipt number"
                  value={saleForm.notes}
                  onChange={e => setSaleForm({...saleForm, notes: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSaleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  <ShoppingCart size={16} /> Record Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffDashboard;
