import React, { useState, useEffect, useRef } from 'react';
import {
  Package, ShoppingCart, Search, LogOut, Box, History, Printer
} from 'lucide-react';

// ── inline alert ──────────────────────────────────────────────────────────────
function InlineAlert({ type, message, onDismiss }) {
  if (!message) return null;
  const styles = {
    error:   { bg: '#fee2e2', border: '#fecaca', color: '#991b1b' },
    success: { bg: '#d1fae5', border: '#6ee7b7', color: '#065f46' },
    warning: { bg: '#fffbeb', border: '#fcd34d', color: '#92400e' },
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

// ── loading skeleton rows ─────────────────────────────────────────────────────
function SkeletonRows({ cols = 5, rows = 4 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}><div className="skeleton-line" /></td>
      ))}
    </tr>
  ));
}

// ── receipt modal ─────────────────────────────────────────────────────────────
function SaleReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;
  const handlePrint = () => window.print();
  return (
    <div className="modal-overlay staff-modal-overlay" onClick={onClose}>
      <div className="modal staff-modal receipt-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header staff-modal-header">
          <h3>Sale Receipt</h3>
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
              <tr><td>Quantity</td><td>{receipt.quantity} {receipt.unit}</td></tr>
              <tr><td>Unit Price</td><td>${Number(receipt.unitPrice).toFixed(2)}</td></tr>
              {receipt.unitPrice !== receipt.standardPrice && (
                <tr style={{ color: '#b45309' }}>
                  <td>Standard Price</td><td>${Number(receipt.standardPrice).toFixed(2)}</td>
                </tr>
              )}
              <tr><td><strong>Total</strong></td><td><strong>${Number(receipt.total).toFixed(2)}</strong></td></tr>
              {receipt.notes && <tr><td>Notes</td><td>{receipt.notes}</td></tr>}
            </tbody>
          </table>
          <hr className="receipt-divider" />
          <p className="receipt-footer">Served by: {receipt.servedBy}</p>
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

function StaffDashboard({ user, onLogout }) {
  // Persist active tab across re-renders
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('staff_active_tab') || 'products'
  );

  const [products,            setProducts]            = useState([]);
  const [searchTerm,          setSearchTerm]          = useState('');
  const [showSaleModal,       setShowSaleModal]        = useState(false);
  const [selectedProduct,     setSelectedProduct]      = useState(null);
  const [recentTransactions,  setRecentTransactions]  = useState([]);
  const [receipt,             setReceipt]             = useState(null);

  // loading flags
  const [loadingProducts,     setLoadingProducts]     = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  // sale form
  const [saleForm, setSaleForm] = useState({ quantity: '', unit_price: '', notes: '' });
  const [saleError, setSaleError] = useState('');
  const [priceWarning, setPriceWarning] = useState('');

  // barcode scanner ref — focuses the search box; scanner sends barcode + Enter
  const searchRef = useRef(null);

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('staff_active_tab', tab);
  };

  useEffect(() => {
    loadProducts();
    loadRecentTransactions();
  }, []);

  // Auto-focus search on products tab so a barcode scanner works immediately
  useEffect(() => {
    if (activeTab === 'products' && searchRef.current) {
      searchRef.current.focus();
    }
  }, [activeTab]);

  // ── data loaders ──────────────────────────────────────────────────────────

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const result = await window.electronAPI.db.all(
        'SELECT * FROM products ORDER BY name ASC'
      );
      setProducts(result);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadRecentTransactions = async () => {
    setLoadingTransactions(true);
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
    } finally {
      setLoadingTransactions(false);
    }
  };

  // ── barcode search: pressing Enter in search auto-opens product if unique match ──

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchTerm.trim();
      if (!term) return;
      // Try exact barcode match first
      const byBarcode = products.find(
        p => p.barcode && p.barcode === term
      );
      if (byBarcode) {
        openSaleModal(byBarcode);
        setSearchTerm('');
        return;
      }
      // Fall back to exact SKU match
      const bySku = products.find(
        p => p.sku.toLowerCase() === term.toLowerCase()
      );
      if (bySku) {
        openSaleModal(bySku);
        setSearchTerm('');
      }
    }
  };

  // ── sale modal ────────────────────────────────────────────────────────────

  const openSaleModal = (product) => {
    setSelectedProduct(product);
    setSaleForm({ quantity: '', unit_price: product.selling_price || '', notes: '' });
    setSaleError('');
    setPriceWarning('');
    setShowSaleModal(true);
  };

  const handlePriceChange = (value) => {
    setSaleForm(prev => ({ ...prev, unit_price: value }));
    if (selectedProduct) {
      const entered   = parseFloat(value);
      const standard  = parseFloat(selectedProduct.selling_price);
      if (!isNaN(entered) && !isNaN(standard) && entered !== standard) {
        setPriceWarning(
          `Standard price is $${standard.toFixed(2)}. ` +
          `You entered $${entered.toFixed(2)}. Add a note to explain the difference.`
        );
      } else {
        setPriceWarning('');
      }
    }
  };

  const handleSaleOperation = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSaleError('');

    const qty = parseInt(saleForm.quantity, 10);
    if (!qty || qty <= 0) {
      setSaleError('Enter a valid quantity greater than zero.');
      return;
    }

    // Price deviation requires a note
    const unitPrice = parseFloat(saleForm.unit_price || selectedProduct.selling_price || 0);
    const standard  = parseFloat(selectedProduct.selling_price);
    if (!isNaN(standard) && unitPrice !== standard && !saleForm.notes.trim()) {
      setSaleError('A note is required when changing the selling price.');
      return;
    }

    // Re-read stock to guard against stale modal data
    const fresh = await window.electronAPI.db.get(
      'SELECT quantity FROM products WHERE id = ?', [selectedProduct.id]
    );
    const currentQty = fresh?.quantity ?? selectedProduct.quantity;
    const newQty = currentQty - qty;

    if (newQty < 0) {
      setSaleError(`Insufficient stock. Only ${currentQty} ${selectedProduct.unit} available.`);
      return;
    }

    const totalAmount = qty * unitPrice;

    try {
      // Atomic: update quantity + insert transaction
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
            selectedProduct.id, 'out', qty, unitPrice,
            totalAmount, saleForm.notes, user.id,
          ],
        },
      ]);

      setShowSaleModal(false);

      // Show receipt before clearing state
      setReceipt({
        productName:   selectedProduct.name,
        sku:           selectedProduct.sku,
        unit:          selectedProduct.unit,
        quantity:      qty,
        unitPrice,
        standardPrice: standard,
        total:         totalAmount,
        notes:         saleForm.notes,
        servedBy:      user.fullName,
      });

      setSaleForm({ quantity: '', unit_price: '', notes: '' });
      setSelectedProduct(null);
      loadProducts();
      loadRecentTransactions();
    } catch (err) {
      setSaleError('Error recording sale: ' + err.message);
    }
  };

  // ── derived stats ──────────────────────────────────────────────────────────

  const filteredProducts     = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );
  const lowStockCount        = products.filter(p => p.quantity <= p.min_stock).length;
  const availableProductsCount = products.filter(p => p.quantity > 0).length;
  const outOfStockCount      = products.filter(p => p.quantity === 0).length;

  // ── nav helper ────────────────────────────────────────────────────────────

  const navBtn = (tab, Icon, label) => (
    <button
      key={tab}
      className={`nav-button ${activeTab === tab ? 'active' : ''}`}
      onClick={() => changeTab(tab)}
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
    <div className="app staff-app">
      <aside className="sidebar staff-sidebar">
        <h1 className="staff-brand"><Package size={24} /> Shop IMS</h1>
        <nav className="staff-nav">
          {navBtn('products',     Box,     'Products')}
          {navBtn('transactions', History, 'Transactions')}
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

        {/* ── PRODUCTS ── */}
        {activeTab === 'products' && (
          <>
            <div className="stats-grid staff-stats-grid">
              <div className="stat-card staff-stat-card">
                <h3>Total Product Lines</h3>
                <div className="value">{products.length}</div>
              </div>
              <div className="stat-card staff-stat-card">
                <h3>Available Products</h3>
                <div className="value" style={{ color: '#0f766e' }}>{availableProductsCount}</div>
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
                  ref={searchRef}
                  className="staff-search-input"
                  type="text"
                  placeholder="Search by name, SKU, or scan barcode…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKey}
                  aria-label="Product search / barcode scan"
                />
                <button className="btn btn-secondary staff-search-btn">
                  <Search size={16} /> Search
                </button>
              </div>

              <table className="staff-table">
                <thead>
                  <tr>
                    <th>SKU</th><th>Name</th><th>Category</th>
                    <th>Stock</th><th>Price</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingProducts
                    ? <SkeletonRows cols={6} rows={5} />
                    : filteredProducts.map(product => (
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
                            disabled={product.quantity === 0}
                            title={product.quantity === 0 ? 'Out of stock' : 'Record sale'}
                          >
                            <ShoppingCart size={14} /> Sell
                          </button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── TRANSACTIONS ── */}
        {activeTab === 'transactions' && (
          <div className="card staff-card">
            <div className="card-header staff-card-header">
              <h2>Recent Sales</h2>
            </div>
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Date</th><th>Product</th><th>Quantity</th>
                  <th>Unit Price</th><th>Total</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loadingTransactions
                  ? <SkeletonRows cols={6} rows={5} />
                  : recentTransactions.map(tx => (
                    <tr key={tx.id}>
                      <td>{new Date(tx.created_at).toLocaleString()}</td>
                      <td>{tx.product_name}</td>
                      <td>{tx.quantity}</td>
                      <td>${tx.unit_price}</td>
                      <td>${tx.total_amount}</td>
                      <td>{tx.notes}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── RECEIPT ── */}
      {receipt && <SaleReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      {/* ── SALE MODAL ── */}
      {showSaleModal && selectedProduct && (
        <div className="modal-overlay staff-modal-overlay" onClick={() => setShowSaleModal(false)}>
          <div className="modal staff-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header staff-modal-header">
              <h3>Record Sale — {selectedProduct.name}</h3>
              <button className="close-btn" onClick={() => setShowSaleModal(false)}>×</button>
            </div>

            <InlineAlert type="error"   message={saleError}    onDismiss={() => setSaleError('')} />
            <InlineAlert type="warning" message={priceWarning} onDismiss={() => setPriceWarning('')} />

            <form onSubmit={handleSaleOperation}>
              <div className="staff-sale-info" style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px' }}>
                <p><strong>Current Stock:</strong> {selectedProduct.quantity} {selectedProduct.unit}</p>
                <p><strong>SKU:</strong> {selectedProduct.sku}</p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number" required min="1"
                    value={saleForm.quantity}
                    onChange={e => setSaleForm({ ...saleForm, quantity: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Selling Price</label>
                  <input
                    type="number" step="0.01"
                    value={saleForm.unit_price}
                    onChange={e => handlePriceChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  Notes{priceWarning ? ' * (required for price change)' : ''}
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g., Customer name, discount reason"
                  value={saleForm.notes}
                  onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })}
                />
              </div>

              {/* live total preview */}
              {saleForm.quantity && saleForm.unit_price && (
                <p className="sale-total-preview">
                  Total: <strong>
                    ${(parseInt(saleForm.quantity || 0, 10) * parseFloat(saleForm.unit_price || 0)).toFixed(2)}
                  </strong>
                </p>
              )}

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
