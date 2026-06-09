import React, { useState, useEffect, useRef } from 'react';
import {
  Package, Users, BarChart3, LogOut, Search, Plus,
  AlertTriangle, Download, LayoutDashboard, Minus, Pencil,
  Trash2, Settings, CheckCircle, Printer
} from 'lucide-react';
import Reports from './Reports';

// ── inline notification banner ───────────────────────────────────────────────
function InlineAlert({ type, message, onDismiss }) {
  if (!message) return null;
  const styles = {
    error:   { bg: '#fee2e2', border: '#fecaca', color: '#991b1b' },
    success: { bg: '#d1fae5', border: '#6ee7b7', color: '#065f46' },
  };
  const s = styles[type] || styles.error;
  return (
    <div
      role="alert"
      style={{
        background: s.bg, border: `1px solid ${s.border}`, color: s.color,
        padding: '10px 14px', borderRadius: '10px', marginBottom: '14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '14px', fontWeight: 500,
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: s.color, fontSize: '18px', lineHeight: 1, marginLeft: '12px' }}
          aria-label="Dismiss"
        >×</button>
      )}
    </div>
  );
}

// ── loading skeleton row ─────────────────────────────────────────────────────
function SkeletonRows({ cols = 5, rows = 4 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}>
          <div className="skeleton-line" />
        </td>
      ))}
    </tr>
  ));
}

// ── receipt modal ────────────────────────────────────────────────────────────
function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;
  const handlePrint = () => window.print();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal receipt-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Stock Receipt</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="receipt-body" id="receipt-print-area">
          <p className="receipt-shop">Shop IMS</p>
          <p className="receipt-date">{new Date().toLocaleString()}</p>
          <hr className="receipt-divider" />
          <table className="receipt-table">
            <tbody>
              <tr><td>Product</td><td>{receipt.productName}</td></tr>
              <tr><td>SKU</td><td>{receipt.sku}</td></tr>
              <tr><td>Operation</td><td>{receipt.type === 'in' ? 'Stock In' : 'Stock Out'}</td></tr>
              <tr><td>Quantity</td><td>{receipt.quantity} {receipt.unit}</td></tr>
              <tr><td>Unit Price</td><td>${Number(receipt.unitPrice).toFixed(2)}</td></tr>
              <tr><td>Total</td><td>${Number(receipt.total).toFixed(2)}</td></tr>
              {receipt.notes && <tr><td>Notes</td><td>{receipt.notes}</td></tr>}
            </tbody>
          </table>
          <hr className="receipt-divider" />
          <p className="receipt-footer">Processed by: {receipt.processedBy}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AdminDashboard({ user, onLogout, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState('overview');

  // data
  const [stats, setStats] = useState({
    totalProducts: 0, totalValue: 0, lowStock: 0, todaySales: 0, monthSales: 0,
  });
  const [products, setProducts]   = useState([]);
  const [users, setUsers]         = useState([]);

  // loading flags
  const [loadingStats,    setLoadingStats]    = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingUsers,    setLoadingUsers]    = useState(true);

  // search
  const [searchTerm, setSearchTerm] = useState('');

  // modal visibility
  const [showUserModal,          setShowUserModal]          = useState(false);
  const [showProductModal,       setShowProductModal]       = useState(false);
  const [showEditProductModal,   setShowEditProductModal]   = useState(false);
  const [showStockModal,         setShowStockModal]         = useState(false);
  const [showDeleteUserModal,    setShowDeleteUserModal]    = useState(false);
  const [showDeleteProductModal, setShowDeleteProductModal] = useState(false);

  // receipt
  const [receipt, setReceipt] = useState(null);

  // selected / editing state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProduct,  setEditingProduct]  = useState(null);
  const [userToDelete,    setUserToDelete]    = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);

  // forms
  const [newUser, setNewUser] = useState({
    username: '', password: '', full_name: '', role: 'staff',
  });
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', category: '', description: '',
    cost_price: '', selling_price: '', quantity: '',
    min_stock: 10, unit: 'pcs', barcode: '', supplier: '',
  });
  const [stockOperation, setStockOperation] = useState({
    type: 'in', quantity: '', unit_price: '', notes: '',
  });
  const [accountForm, setAccountForm] = useState({
    username: user.username, currentPassword: '', newPassword: '', confirmPassword: '',
  });

  // inline errors / success per section
  const [modalError,   setModalError]   = useState('');
  const [accountMsg,   setAccountMsg]   = useState({ type: '', text: '' });

  useEffect(() => {
    loadStats();
    loadProducts();
    loadUsers();
  }, []);

  useEffect(() => {
    setAccountForm(prev => ({ ...prev, username: user.username }));
  }, [user.username]);

  // ── data loaders ──────────────────────────────────────────────────────────

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const monthStart = new Date(
        new Date().getFullYear(), new Date().getMonth(), 1
      ).toISOString();

      const [productsRes, lowStockRes, todaySalesRes, monthSalesRes, valueRes] =
        await Promise.all([
          window.electronAPI.db.get('SELECT COUNT(*) as count FROM products'),
          window.electronAPI.db.get(
            'SELECT COUNT(*) as count FROM products WHERE quantity <= min_stock'
          ),
          window.electronAPI.db.get(
            `SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions
             WHERE type = 'out' AND DATE(created_at) = DATE('now')`
          ),
          window.electronAPI.db.get(
            `SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions
             WHERE type = 'out' AND created_at >= ?`,
            [monthStart]
          ),
          window.electronAPI.db.get(
            'SELECT COALESCE(SUM(quantity * cost_price), 0) as total FROM products'
          ),
        ]);

      setStats({
        totalProducts: productsRes.count,
        totalValue:    valueRes.total    || 0,
        lowStock:      lowStockRes.count,
        todaySales:    todaySalesRes.total,
        monthSales:    monthSalesRes.total,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const result = await window.electronAPI.db.all(
        `SELECT p.*, COALESCE(s.sold_quantity, 0) as sold_quantity
         FROM products p
         LEFT JOIN (
           SELECT product_id, SUM(quantity) as sold_quantity
           FROM transactions WHERE type = 'out'
           GROUP BY product_id
         ) s ON s.product_id = p.id
         ORDER BY p.quantity <= p.min_stock DESC, p.name ASC`
      );
      setProducts(result);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const result = await window.electronAPI.db.all(
        'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
      );
      setUsers(result);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // ── user management ───────────────────────────────────────────────────────

  const handleAddUser = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      const hashed = await window.electronAPI.db.hashPassword(newUser.password);
      await window.electronAPI.db.run(
        'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
        [newUser.username, hashed, newUser.full_name, newUser.role]
      );
      setShowUserModal(false);
      setNewUser({ username: '', password: '', full_name: '', role: 'staff' });
      loadUsers();
    } catch (err) {
      setModalError(err.message.includes('UNIQUE')
        ? 'Username already exists.'
        : 'Error adding user: ' + err.message);
    }
  };

  const handleToggleUser = async (targetUser) => {
    try {
      if (targetUser.role === 'admin') {
        return;
      }
      if (targetUser.id === user.id) {
        return;
      }
      await window.electronAPI.db.run(
        'UPDATE users SET is_active = ? WHERE id = ?',
        [targetUser.is_active ? 0 : 1, targetUser.id]
      );
      loadUsers();
    } catch (err) {
      console.error('Error toggling user:', err);
    }
  };

  const handleDeleteUser = (targetUser) => {
    if (targetUser.role === 'admin' || targetUser.id === user.id) return;
    setUserToDelete(targetUser);
    setShowDeleteUserModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await window.electronAPI.db.run('DELETE FROM users WHERE id = ?', [userToDelete.id]);
      setShowDeleteUserModal(false);
      setUserToDelete(null);
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const cancelDeleteUser = () => {
    setShowDeleteUserModal(false);
    setUserToDelete(null);
  };

  // ── product management ────────────────────────────────────────────────────

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await window.electronAPI.db.run(
        `INSERT INTO products (sku, name, category, description, cost_price,
         selling_price, quantity, min_stock, unit, barcode, supplier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newProduct.sku, newProduct.name, newProduct.category,
          newProduct.description, newProduct.cost_price || 0,
          newProduct.selling_price || 0, newProduct.quantity || 0,
          newProduct.min_stock, newProduct.unit, newProduct.barcode, newProduct.supplier,
        ]
      );
      setShowProductModal(false);
      setNewProduct({
        sku: '', name: '', category: '', description: '',
        cost_price: '', selling_price: '', quantity: '',
        min_stock: 10, unit: 'pcs', barcode: '', supplier: '',
      });
      loadProducts();
      loadStats();
    } catch (err) {
      setModalError(err.message.includes('UNIQUE')
        ? 'A product with that SKU already exists.'
        : 'Error adding product: ' + err.message);
    }
  };

  const openStockModal = (product, type) => {
    const defaultPrice = type === 'in' ? product.cost_price : product.selling_price;
    setSelectedProduct(product);
    setStockOperation({ type, quantity: '', unit_price: defaultPrice || '', notes: '' });
    setModalError('');
    setShowStockModal(true);
  };

  const openEditProductModal = (product) => {
    setEditingProduct({
      id: product.id, sku: product.sku || '', name: product.name || '',
      category: product.category || '', description: product.description || '',
      cost_price: product.cost_price ?? '', selling_price: product.selling_price ?? '',
      quantity: product.quantity ?? 0, min_stock: product.min_stock ?? 10,
      unit: product.unit || 'pcs', barcode: product.barcode || '',
      supplier: product.supplier || '',
    });
    setModalError('');
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setModalError('');
    try {
      await window.electronAPI.db.run(
        `UPDATE products
         SET sku=?, name=?, category=?, description=?, cost_price=?,
             selling_price=?, quantity=?, min_stock=?, unit=?, barcode=?,
             supplier=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [
          editingProduct.sku, editingProduct.name, editingProduct.category,
          editingProduct.description, parseFloat(editingProduct.cost_price || 0),
          parseFloat(editingProduct.selling_price || 0),
          parseInt(editingProduct.quantity || 0, 10),
          parseInt(editingProduct.min_stock || 0, 10),
          editingProduct.unit, editingProduct.barcode, editingProduct.supplier,
          editingProduct.id,
        ]
      );
      setShowEditProductModal(false);
      setEditingProduct(null);
      loadProducts();
      loadStats();
    } catch (err) {
      setModalError('Error saving product: ' + err.message);
    }
  };

  const requestDeleteProduct = () => {
    if (!editingProduct) return;
    setProductToDelete(editingProduct);
    setShowDeleteProductModal(true);
  };

  const cancelDeleteProduct = () => {
    setShowDeleteProductModal(false);
    setProductToDelete(null);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      // Atomic: delete transactions then product
      await window.electronAPI.db.transaction([
        { sql: 'DELETE FROM transactions WHERE product_id = ?', params: [productToDelete.id] },
        { sql: 'DELETE FROM products WHERE id = ?',             params: [productToDelete.id] },
      ]);
      setShowDeleteProductModal(false);
      setProductToDelete(null);
      setShowEditProductModal(false);
      setEditingProduct(null);
      loadProducts();
      loadStats();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  // ── stock operation ───────────────────────────────────────────────────────

  const handleStockOperation = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setModalError('');

    const qty = parseInt(stockOperation.quantity, 10);
    if (!qty || qty <= 0) {
      setModalError('Enter a valid quantity greater than zero.');
      return;
    }

    // Re-read current stock to guard against stale modal data
    const fresh = await window.electronAPI.db.get(
      'SELECT quantity FROM products WHERE id = ?', [selectedProduct.id]
    );
    const currentQty = fresh?.quantity ?? selectedProduct.quantity;
    const newQty = stockOperation.type === 'in' ? currentQty + qty : currentQty - qty;

    if (newQty < 0) {
      setModalError(`Insufficient stock. Only ${currentQty} ${selectedProduct.unit} available.`);
      return;
    }

    const defaultPrice = stockOperation.type === 'in'
      ? selectedProduct.cost_price : selectedProduct.selling_price;
    const unitPrice   = parseFloat(stockOperation.unit_price || defaultPrice || 0);
    const totalAmount = qty * unitPrice;

    try {
      // Atomic: update quantity + insert transaction in one DB transaction
      await window.electronAPI.db.transaction([
        {
          sql:    'UPDATE products SET quantity=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
          params: [newQty, selectedProduct.id],
        },
        {
          sql:    `INSERT INTO transactions
                   (product_id, type, quantity, unit_price, total_amount, notes, user_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [
            selectedProduct.id, stockOperation.type, qty,
            unitPrice, totalAmount, stockOperation.notes, user.id,
          ],
        },
      ]);

      setShowStockModal(false);
      setSelectedProduct(null);
      setStockOperation({ type: 'in', quantity: '', unit_price: '', notes: '' });
      loadProducts();
      loadStats();

      // Show receipt
      setReceipt({
        productName:  selectedProduct.name,
        sku:          selectedProduct.sku,
        unit:         selectedProduct.unit,
        type:         stockOperation.type,
        quantity:     qty,
        unitPrice,
        total:        totalAmount,
        notes:        stockOperation.notes,
        processedBy:  user.fullName,
      });
    } catch (err) {
      setModalError('Error updating stock: ' + err.message);
    }
  };

  // ── account settings ──────────────────────────────────────────────────────

  const handleAccountUpdate = async (e) => {
    e.preventDefault();
    setAccountMsg({ type: '', text: '' });

    const username = accountForm.username.trim();
    if (!username) {
      setAccountMsg({ type: 'error', text: 'Username is required.' });
      return;
    }
    if (!accountForm.currentPassword) {
      setAccountMsg({ type: 'error', text: 'Enter your current password to confirm changes.' });
      return;
    }
    if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
      setAccountMsg({ type: 'error', text: 'New password confirmation does not match.' });
      return;
    }
    if (username === user.username && !accountForm.newPassword) {
      setAccountMsg({ type: 'error', text: 'No changes detected.' });
      return;
    }

    try {
      const authRow = await window.electronAPI.db.get(
        'SELECT password FROM users WHERE id = ?', [user.id]
      );
      const valid = authRow
        ? await window.electronAPI.db.verifyPassword(accountForm.currentPassword, authRow.password)
        : false;

      if (!valid) {
        setAccountMsg({ type: 'error', text: 'Current password is incorrect.' });
        return;
      }

      const existingUser = await window.electronAPI.db.get(
        'SELECT id FROM users WHERE username = ? AND id != ?', [username, user.id]
      );
      if (existingUser) {
        setAccountMsg({ type: 'error', text: 'That username is already in use.' });
        return;
      }

      let newHash = null;
      if (accountForm.newPassword) {
        newHash = await window.electronAPI.db.hashPassword(accountForm.newPassword);
      }

      await window.electronAPI.db.run(
        `UPDATE users
         SET username = ?,
             password = CASE WHEN ? IS NULL THEN password ELSE ? END
         WHERE id = ?`,
        [username, newHash, newHash, user.id]
      );

      onUserUpdate?.({ username });
      setAccountForm({ username, currentPassword: '', newPassword: '', confirmPassword: '' });
      setAccountMsg({ type: 'success', text: 'Account credentials updated successfully.' });
      loadUsers();
    } catch (err) {
      setAccountMsg({ type: 'error', text: 'Error updating account: ' + err.message });
    }
  };

  // ── CSV export with native save dialog ───────────────────────────────────

  const exportToCSV = async (data, defaultFileName) => {
    if (!data || data.length === 0) return;
    try {
      const result = await window.electronAPI.dialog.saveFile(defaultFileName);
      if (result.canceled || !result.filePath) return;

      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row =>
          headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\r\n');

      // Write via IPC run — use a temp approach: store in a blob and save via Electron fs
      // We expose fs write through a dedicated channel for safety
      await window.electronAPI.db.run(
        // This won't actually execute SQL — we use a workaround below
        'SELECT 1', []
      );

      // Fallback: use the browser download approach since we have the filePath
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filePath.split(/[\\/]/).pop();
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── nav helper ────────────────────────────────────────────────────────────

  const navBtn = (tab, Icon, label) => (
    <button
      key={tab}
      className={`nav-button ${activeTab === tab ? 'active' : ''}`}
      onClick={() => setActiveTab(tab)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', width: '100%',
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', color: 'inherit', textAlign: 'left',
        borderRadius: '12px',
      }}
    >
      <Icon size={20} /> {label}
    </button>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="app admin-app">
      <aside className="sidebar admin-sidebar">
        <h1 className="admin-brand"><Package size={24} /> Shop IMS</h1>
        <nav className="admin-nav">
          {navBtn('overview',  LayoutDashboard, 'Overview')}
          {navBtn('products',  Package,         'All Products')}
          {navBtn('reports',   BarChart3,       'Reports')}
          {navBtn('users',     Users,           'Users')}
          {navBtn('account',   Settings,        'Account')}
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

        {/* ── OVERVIEW ── */}
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
              {loadingStats ? (
                <div className="stat-card"><div className="skeleton-line" /><div className="skeleton-line skeleton-line--wide" /></div>
              ) : (
                <>
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
                    <div className="value" style={{ color: '#ef4444' }}>{stats.lowStock}</div>
                  </div>
                  <div className="stat-card">
                    <h3>Today's Sales</h3>
                    <div className="value">${stats.todaySales.toFixed(2)}</div>
                  </div>
                  <div className="stat-card">
                    <h3>Month Sales</h3>
                    <div className="value">${stats.monthSales.toFixed(2)}</div>
                  </div>
                </>
              )}
            </div>

            <div className="card admin-card">
              <div className="card-header">
                <h2><AlertTriangle size={20} /> Low Stock Items</h2>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>SKU</th><th>Name</th><th>Current Stock</th>
                    <th>Min Required</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingProducts
                    ? <SkeletonRows cols={5} rows={3} />
                    : products.filter(p => p.quantity <= p.min_stock).length === 0
                      ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: '#10b981' }}>
                            All stock levels are healthy!
                          </td>
                        </tr>
                      )
                      : products.filter(p => p.quantity <= p.min_stock).map(product => (
                        <tr key={product.id}>
                          <td>{product.sku}</td>
                          <td>{product.name}</td>
                          <td>{product.quantity} {product.unit}</td>
                          <td>{product.min_stock} {product.unit}</td>
                          <td><span className="status-badge status-low">CRITICAL</span></td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── PRODUCTS ── */}
        {activeTab === 'products' && (
          <div className="card admin-card">
            <div className="card-header">
              <h2>All Products</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={() => { setModalError(''); setShowProductModal(true); }}>
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
                placeholder="Search products…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>SKU</th><th>Name</th><th>Category</th><th>Stock</th>
                  <th>Cost</th><th>Selling</th><th>Expected Total</th><th>Earned So Far</th>
                </tr>
              </thead>
              <tbody>
                {loadingProducts
                  ? <SkeletonRows cols={8} rows={5} />
                  : filteredProducts.map(product => (
                    <tr
                      key={product.id}
                      className="product-row"
                      onClick={() => openEditProductModal(product)}
                      title="Click to edit"
                    >
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
                      <td>${(product.quantity * product.selling_price).toFixed(2)}</td>
                      <td>${((product.sold_quantity || 0) * product.selling_price).toFixed(2)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* ── REPORTS ── */}
        {activeTab === 'reports' && <Reports />}

        {/* ── USERS ── */}
        {activeTab === 'users' && (
          <div className="card admin-card">
            <div className="card-header">
              <h2>User Management</h2>
              <button className="btn btn-primary" onClick={() => { setModalError(''); setShowUserModal(true); }}>
                <Plus size={16} /> Add User
              </button>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th><th>Full Name</th><th>Role</th>
                  <th>Status</th><th>Created</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers
                  ? <SkeletonRows cols={6} rows={3} />
                  : users.map(u => (
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
                        {u.role === 'admin' ? (
                          <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                            Protected
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className={`btn ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                              style={{ padding: '6px 12px' }}
                              onClick={() => handleToggleUser(u)}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '6px 10px' }}
                              onClick={() => handleDeleteUser(u)}
                              title="Delete user"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* ── ACCOUNT ── */}
        {activeTab === 'account' && (
          <div className="card admin-card" style={{ maxWidth: '760px' }}>
            <div className="card-header">
              <h2>Account Settings</h2>
            </div>
            <InlineAlert
              type={accountMsg.type}
              message={accountMsg.text}
              onDismiss={() => setAccountMsg({ type: '', text: '' })}
            />
            <form onSubmit={handleAccountUpdate}>
              <div className="form-group">
                <label>New Username *</label>
                <input
                  type="text" required
                  value={accountForm.username}
                  onChange={e => setAccountForm({ ...accountForm, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Current Password *</label>
                <input
                  type="password" required
                  value={accountForm.currentPassword}
                  onChange={e => setAccountForm({ ...accountForm, currentPassword: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>New Password (optional)</label>
                  <input
                    type="password"
                    value={accountForm.newPassword}
                    onChange={e => setAccountForm({ ...accountForm, newPassword: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={accountForm.confirmPassword}
                    onChange={e => setAccountForm({ ...accountForm, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary">Save Credentials</button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* ── RECEIPT ── */}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      {/* ── EDIT PRODUCT MODAL ── */}
      {showEditProductModal && editingProduct && (
        <div className="modal-overlay" onClick={() => setShowEditProductModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Product Details</h3>
              <button className="close-btn" onClick={() => setShowEditProductModal(false)}>×</button>
            </div>
            <InlineAlert type="error" message={modalError} onDismiss={() => setModalError('')} />
            <form onSubmit={handleUpdateProduct}>
              <div className="form-row">
                <div className="form-group">
                  <label>SKU *</label>
                  <input type="text" required value={editingProduct.sku}
                    onChange={e => setEditingProduct({ ...editingProduct, sku: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Barcode</label>
                  <input type="text" value={editingProduct.barcode}
                    onChange={e => setEditingProduct({ ...editingProduct, barcode: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Product Name *</label>
                <input type="text" required value={editingProduct.name}
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <input type="text" value={editingProduct.category}
                    onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input type="text" value={editingProduct.supplier}
                    onChange={e => setEditingProduct({ ...editingProduct, supplier: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cost Price</label>
                  <input type="number" step="0.01" value={editingProduct.cost_price}
                    onChange={e => setEditingProduct({ ...editingProduct, cost_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Selling Price</label>
                  <input type="number" step="0.01" value={editingProduct.selling_price}
                    onChange={e => setEditingProduct({ ...editingProduct, selling_price: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Current Quantity</label>
                  <input type="number" value={editingProduct.quantity}
                    onChange={e => setEditingProduct({ ...editingProduct, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Min Stock Level</label>
                  <input type="number" value={editingProduct.min_stock}
                    onChange={e => setEditingProduct({ ...editingProduct, min_stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select value={editingProduct.unit}
                    onChange={e => setEditingProduct({ ...editingProduct, unit: e.target.value })}>
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
                <textarea rows="2" value={editingProduct.description}
                  onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-danger" onClick={requestDeleteProduct}>
                  <Trash2 size={16} /> Delete
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Pencil size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD PRODUCT MODAL ── */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Product</h3>
              <button className="close-btn" onClick={() => setShowProductModal(false)}>×</button>
            </div>
            <InlineAlert type="error" message={modalError} onDismiss={() => setModalError('')} />
            <form onSubmit={handleAddProduct}>
              <div className="form-row">
                <div className="form-group">
                  <label>SKU *</label>
                  <input type="text" required value={newProduct.sku}
                    onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Barcode</label>
                  <input type="text" value={newProduct.barcode}
                    onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Product Name *</label>
                <input type="text" required value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <input type="text" value={newProduct.category}
                    onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input type="text" value={newProduct.supplier}
                    onChange={e => setNewProduct({ ...newProduct, supplier: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cost Price</label>
                  <input type="number" step="0.01" value={newProduct.cost_price}
                    onChange={e => setNewProduct({ ...newProduct, cost_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Selling Price</label>
                  <input type="number" step="0.01" value={newProduct.selling_price}
                    onChange={e => setNewProduct({ ...newProduct, selling_price: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Initial Quantity</label>
                  <input type="number" value={newProduct.quantity}
                    onChange={e => setNewProduct({ ...newProduct, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Min Stock Level</label>
                  <input type="number" value={newProduct.min_stock}
                    onChange={e => setNewProduct({ ...newProduct, min_stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select value={newProduct.unit}
                    onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}>
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
                <textarea rows="2" value={newProduct.description}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
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

      {/* ── STOCK OPERATION MODAL ── */}
      {showStockModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {stockOperation.type === 'in' ? 'Stock In' : 'Stock Out'} — {selectedProduct.name}
              </h3>
              <button className="close-btn" onClick={() => setShowStockModal(false)}>×</button>
            </div>
            <InlineAlert type="error" message={modalError} onDismiss={() => setModalError('')} />
            <form onSubmit={handleStockOperation}>
              <div className="admin-stock-info" style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px' }}>
                <p><strong>Current Stock:</strong> {selectedProduct.quantity} {selectedProduct.unit}</p>
                <p><strong>SKU:</strong> {selectedProduct.sku}</p>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Operation Type</label>
                  <select value={stockOperation.type}
                    onChange={e => setStockOperation({ ...stockOperation, type: e.target.value })}>
                    <option value="in">Stock In (Receive)</option>
                    <option value="out">Stock Out (Adjust/Sell)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input type="number" min="1" required value={stockOperation.quantity}
                    onChange={e => setStockOperation({ ...stockOperation, quantity: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Unit Price</label>
                <input type="number" step="0.01"
                  placeholder={stockOperation.type === 'in' ? selectedProduct.cost_price : selectedProduct.selling_price}
                  value={stockOperation.unit_price}
                  onChange={e => setStockOperation({ ...stockOperation, unit_price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows="2" placeholder="e.g., Supplier delivery, correction, sale"
                  value={stockOperation.notes}
                  onChange={e => setStockOperation({ ...stockOperation, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`btn ${stockOperation.type === 'in' ? 'btn-success' : 'btn-danger'}`}>
                  {stockOperation.type === 'in' ? <Plus size={16} /> : <Minus size={16} />}
                  {stockOperation.type === 'in' ? ' Add Stock' : ' Remove Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD USER MODAL ── */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button className="close-btn" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <InlineAlert type="error" message={modalError} onDismiss={() => setModalError('')} />
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label>Username *</label>
                <input type="text" required value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" required value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={newUser.full_name}
                  onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
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

      {/* ── DELETE USER CONFIRMATION ── */}
      {showDeleteUserModal && userToDelete && (
        <div className="modal-overlay" onClick={cancelDeleteUser}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm User Deletion</h3>
              <button className="close-btn" onClick={cancelDeleteUser}>×</button>
            </div>
            <div className="admin-stock-info" style={{ marginBottom: '18px', padding: '14px', borderRadius: '8px' }}>
              <p><strong>Username:</strong> {userToDelete.username}</p>
              <p><strong>Role:</strong> {userToDelete.role}</p>
              <p><strong>Status:</strong> {userToDelete.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <p style={{ marginBottom: '20px', color: '#991b1b', fontWeight: 600 }}>
              This action is permanent and cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={cancelDeleteUser}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteUser}>
                <Trash2 size={16} /> Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE PRODUCT CONFIRMATION ── */}
      {showDeleteProductModal && productToDelete && (
        <div className="modal-overlay" onClick={cancelDeleteProduct}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Product Deletion</h3>
              <button className="close-btn" onClick={cancelDeleteProduct}>×</button>
            </div>
            <div className="admin-stock-info" style={{ marginBottom: '18px', padding: '14px', borderRadius: '8px' }}>
              <p><strong>SKU:</strong> {productToDelete.sku}</p>
              <p><strong>Name:</strong> {productToDelete.name}</p>
              <p><strong>Current Stock:</strong> {productToDelete.quantity} {productToDelete.unit}</p>
            </div>
            <p style={{ marginBottom: '20px', color: '#991b1b', fontWeight: 600 }}>
              This will permanently remove the product and its transaction history.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={cancelDeleteProduct}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteProduct}>
                <Trash2 size={16} /> Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
