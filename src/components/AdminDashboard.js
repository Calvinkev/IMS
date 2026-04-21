import React, { useState, useEffect } from 'react';
import { 
  Package, Users, BarChart3, LogOut, Search, Plus,
  AlertTriangle, Download, LayoutDashboard, Minus
} from 'lucide-react';
import Reports from './Reports';

function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStock: 0,
    todaySales: 0,
    monthSales: 0
  });
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newUser, setNewUser] = useState({
    username: '', password: '', full_name: '', role: 'staff'
  });
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', category: '', description: '',
    cost_price: '', selling_price: '', quantity: '',
    min_stock: 10, unit: 'pcs', barcode: '', supplier: ''
  });
  const [stockOperation, setStockOperation] = useState({
    type: 'in',
    quantity: '',
    unit_price: '',
    notes: ''
  });

  useEffect(() => {
    loadStats();
    loadProducts();
    loadUsers();
  }, []);

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [productsRes, lowStockRes, todaySalesRes, monthSalesRes] = await Promise.all([
        window.electronAPI.db.get('SELECT COUNT(*) as count FROM products'),
        window.electronAPI.db.get('SELECT COUNT(*) as count FROM products WHERE quantity <= min_stock'),
        window.electronAPI.db.get(
          `SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions 
           WHERE type = 'out' AND DATE(created_at) = DATE('now')`
        ),
        window.electronAPI.db.get(
          `SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions 
           WHERE type = 'out' AND created_at >= ?`,
          [monthStart]
        )
      ]);

      const valueRes = await window.electronAPI.db.get(
        'SELECT SUM(quantity * cost_price) as total FROM products'
      );

      setStats({
        totalProducts: productsRes.count,
        totalValue: valueRes.total || 0,
        lowStock: lowStockRes.count,
        todaySales: todaySalesRes.total,
        monthSales: monthSalesRes.total
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const result = await window.electronAPI.db.all(
        'SELECT * FROM products ORDER BY quantity <= min_stock DESC, name ASC'
      );
      setProducts(result);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const result = await window.electronAPI.db.all(
        'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
      );
      setUsers(result);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await window.electronAPI.db.run(
        'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
        [newUser.username, newUser.password, newUser.full_name, newUser.role]
      );
      setShowUserModal(false);
      setNewUser({ username: '', password: '', full_name: '', role: 'staff' });
      loadUsers();
    } catch (err) {
      alert('Error adding user: ' + err.message);
    }
  };

  const handleToggleUser = async (userId, currentStatus) => {
    try {
      await window.electronAPI.db.run(
        'UPDATE users SET is_active = ? WHERE id = ?',
        [currentStatus ? 0 : 1, userId]
      );
      loadUsers();
    } catch (err) {
      alert('Error updating user: ' + err.message);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await window.electronAPI.db.run(
        `INSERT INTO products (sku, name, category, description, cost_price,
         selling_price, quantity, min_stock, unit, barcode, supplier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newProduct.sku,
          newProduct.name,
          newProduct.category,
          newProduct.description,
          newProduct.cost_price || 0,
          newProduct.selling_price || 0,
          newProduct.quantity || 0,
          newProduct.min_stock,
          newProduct.unit,
          newProduct.barcode,
          newProduct.supplier
        ]
      );

      setShowProductModal(false);
      setNewProduct({
        sku: '', name: '', category: '', description: '',
        cost_price: '', selling_price: '', quantity: '',
        min_stock: 10, unit: 'pcs', barcode: '', supplier: ''
      });
      loadProducts();
      loadStats();
    } catch (err) {
      alert('Error adding product: ' + err.message);
    }
  };

  const openStockModal = (product, type) => {
    const defaultPrice = type === 'in' ? product.cost_price : product.selling_price;
    setSelectedProduct(product);
    setStockOperation({
      type,
      quantity: '',
      unit_price: defaultPrice || '',
      notes: ''
    });
    setShowStockModal(true);
  };

  const handleStockOperation = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      const qty = parseInt(stockOperation.quantity, 10);
      if (!qty || qty <= 0) {
        alert('Enter a valid quantity.');
        return;
      }

      const newQty = stockOperation.type === 'in'
        ? selectedProduct.quantity + qty
        : selectedProduct.quantity - qty;

      if (newQty < 0) {
        alert('Insufficient stock for stock-out operation.');
        return;
      }

      await window.electronAPI.db.run(
        'UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQty, selectedProduct.id]
      );

      const defaultPrice = stockOperation.type === 'in'
        ? selectedProduct.cost_price
        : selectedProduct.selling_price;
      const unitPrice = parseFloat(stockOperation.unit_price || defaultPrice || 0);
      const totalAmount = qty * unitPrice;

      await window.electronAPI.db.run(
        `INSERT INTO transactions (product_id, type, quantity, unit_price, total_amount, notes, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          selectedProduct.id,
          stockOperation.type,
          qty,
          unitPrice,
          totalAmount,
          stockOperation.notes,
          user.id
        ]
      );

      setShowStockModal(false);
      setSelectedProduct(null);
      setStockOperation({ type: 'in', quantity: '', unit_price: '', notes: '' });
      loadProducts();
      loadStats();
    } catch (err) {
      alert('Error updating stock: ' + err.message);
    }
  };

  const exportToCSV = (data, filename) => {
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app admin-app">
      <aside className="sidebar admin-sidebar">
        <h1 className="admin-brand"><Package size={24} /> Shop IMS</h1>
        <nav className="admin-nav">
          <a 
            href="#overview" 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={20} /> Overview
          </a>
          <a 
            href="#products" 
            className={activeTab === 'products' ? 'active' : ''}
            onClick={() => setActiveTab('products')}
          >
            <Package size={20} /> All Products
          </a>
          <a 
            href="#reports" 
            className={activeTab === 'reports' ? 'active' : ''}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 size={20} /> Reports
          </a>
          <a 
            href="#users" 
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            <Users size={20} /> Users
          </a>
        </nav>
        <div className="admin-user-wrap">
          <div className="admin-user-panel">
            <p className="admin-user-caption">Admin</p>
            <p className="admin-user-name">{user.fullName}</p>
          </div>
          <button className="btn btn-secondary admin-logout-btn" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content admin-main-content">
        {activeTab === 'overview' && (
          <>
            <div className="admin-hero">
              <div>
                <p className="admin-hero-eyebrow">Operations Console</p>
                <h2 className="admin-hero-title">Welcome back, {user.fullName}</h2>
              </div>
              <p className="admin-hero-date">{new Date().toLocaleDateString()}</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Products</h3>
                <div className="value">{stats.totalProducts}</div>
              </div>
              <div className="stat-card">
                <h3>Inventory Value</h3>
                <div className="value">${stats.totalValue.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <h3 style={{ color: '#ef4444' }}>Low Stock Alert</h3>
                <div className="value" style={{ color: '#ef4444' }}>
                  {stats.lowStock}
                </div>
              </div>
              <div className="stat-card">
                <h3>Today's Sales</h3>
                <div className="value">${stats.todaySales.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <h3>Month Sales</h3>
                <div className="value">${stats.monthSales.toFixed(2)}</div>
              </div>
            </div>

            <div className="card admin-card">
              <div className="card-header">
                <h2><AlertTriangle size={20} /> Low Stock Items</h2>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Current Stock</th>
                    <th>Min Required</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.filter(p => p.quantity <= p.min_stock).map(product => (
                    <tr key={product.id}>
                      <td>{product.sku}</td>
                      <td>{product.name}</td>
                      <td>{product.quantity} {product.unit}</td>
                      <td>{product.min_stock} {product.unit}</td>
                      <td>
                        <span className="status-badge status-low">
                          CRITICAL
                        </span>
                      </td>
                    </tr>
                  ))}
                  {products.filter(p => p.quantity <= p.min_stock).length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: '#10b981' }}>
                        All stock levels are healthy!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'products' && (
          <div className="card admin-card">
            <div className="card-header">
              <h2>All Products</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={() => setShowProductModal(true)}>
                  <Plus size={16} /> Add Product
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => exportToCSV(products, 'products.csv')}
                >
                  <Download size={16} /> Export CSV
                </button>
              </div>
            </div>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Cost</th>
                  <th>Selling</th>
                  <th>Value</th>
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
                    <td>${product.cost_price}</td>
                    <td>${product.selling_price}</td>
                    <td>${(product.quantity * product.cost_price).toFixed(2)}</td>
                    <td>
                      <button
                        className="btn btn-success"
                        style={{ padding: '6px 12px', marginRight: '8px' }}
                        onClick={() => openStockModal(product, 'in')}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 12px' }}
                        onClick={() => openStockModal(product, 'out')}
                      >
                        <Minus size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reports' && <Reports />}

        {activeTab === 'users' && (
          <div className="card admin-card">
            <div className="card-header">
              <h2>User Management</h2>
              <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>
                <Plus size={16} /> Add User
              </button>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.full_name}</td>
                    <td>{u.role}</td>
                    <td>
                      <span className={`status-badge ${u.is_active ? 'status-ok' : 'status-low'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      {u.username !== 'admin' && (
                        <button 
                          className={`btn ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                          style={{ padding: '6px 12px' }}
                          onClick={() => handleToggleUser(u.id, u.is_active)}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add Product Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Product</h3>
              <button className="close-btn" onClick={() => setShowProductModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddProduct}>
              <div className="form-row">
                <div className="form-group">
                  <label>SKU *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Barcode</label>
                  <input
                    type="text"
                    value={newProduct.barcode}
                    onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  required
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    value={newProduct.category}
                    onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input
                    type="text"
                    value={newProduct.supplier}
                    onChange={e => setNewProduct({ ...newProduct, supplier: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.cost_price}
                    onChange={e => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Selling Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.selling_price}
                    onChange={e => setNewProduct({ ...newProduct, selling_price: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Initial Quantity</label>
                  <input
                    type="number"
                    value={newProduct.quantity}
                    onChange={e => setNewProduct({ ...newProduct, quantity: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Min Stock Level</label>
                  <input
                    type="number"
                    value={newProduct.min_stock}
                    onChange={e => setNewProduct({ ...newProduct, min_stock: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select
                    value={newProduct.unit}
                    onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}
                  >
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilograms</option>
                    <option value="liters">Liters</option>
                    <option value="boxes">Boxes</option>
                    <option value="packs">Packs</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows="2"
                  value={newProduct.description}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} /> Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Operation Modal */}
      {showStockModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {stockOperation.type === 'in' ? 'Stock In' : 'Stock Out'} - {selectedProduct.name}
              </h3>
              <button className="close-btn" onClick={() => setShowStockModal(false)}>×</button>
            </div>
            <form onSubmit={handleStockOperation}>
              <div className="admin-stock-info" style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px' }}>
                <p><strong>Current Stock:</strong> {selectedProduct.quantity} {selectedProduct.unit}</p>
                <p><strong>SKU:</strong> {selectedProduct.sku}</p>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Operation Type</label>
                  <select
                    value={stockOperation.type}
                    onChange={e => setStockOperation({ ...stockOperation, type: e.target.value })}
                  >
                    <option value="in">Stock In (Receive)</option>
                    <option value="out">Stock Out (Adjust/Sell)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={stockOperation.quantity}
                    onChange={e => setStockOperation({ ...stockOperation, quantity: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Unit Price</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={
                    stockOperation.type === 'in'
                      ? selectedProduct.cost_price
                      : selectedProduct.selling_price
                  }
                  value={stockOperation.unit_price}
                  onChange={e => setStockOperation({ ...stockOperation, unit_price: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g., Supplier delivery, correction, sale"
                  value={stockOperation.notes}
                  onChange={e => setStockOperation({ ...stockOperation, notes: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStockModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${stockOperation.type === 'in' ? 'btn-success' : 'btn-danger'}`}
                >
                  {stockOperation.type === 'in' ? <Plus size={16} /> : <Minus size={16} />}
                  {stockOperation.type === 'in' ? ' Add Stock' : ' Remove Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button className="close-btn" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label>Username *</label>
                <input 
                  type="text" 
                  required
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input 
                  type="password" 
                  required
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text"
                  value={newUser.full_name}
                  onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} /> Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
