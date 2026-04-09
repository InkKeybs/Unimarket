import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { LoaderIcon, toast } from "react-hot-toast";
import styles from "./Admin.module.scss";

const STATUS_COLORS = {
  pending:  { background: "#fff7ed", color: "#c2410c" },
  approved: { background: "#ecfdf5", color: "#047857" },
  rejected: { background: "#fef2f2", color: "#b91c1c" },
  paid:     { background: "#eff6ff", color: "#1d4ed8" },
};

function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending"); // "pending" | "all" | "withdrawals" | "payments"

  // --- Pending tab state ---
  const [pending, setPending] = useState([]);

  // --- All listings tab state ---
  const [allLoading, setAllLoading] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // productId waiting for confirm

  // --- Withdrawals tab state ---
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("");

  // --- Payments tab state ---
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");

  const getToken = () => JSON.parse(localStorage.getItem("token"));

  const loadPendingProducts = useCallback((token) => {
    return axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/admin/pending-products",
      data: { token },
    }).then((response) => {
      setPending(response.data.details || []);
    });
  }, []);

  const loadAllProducts = useCallback((token, searchVal, statusVal) => {
    setAllLoading(true);
    return axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/admin/all-products",
      data: { token, search: searchVal, statusFilter: statusVal },
    })
      .then((response) => {
        setAllItems(response.data.details || []);
      })
      .catch(() => toast.error("Failed to load products"))
      .finally(() => setAllLoading(false));
  }, []);

  const loadWithdrawals = useCallback((token, searchVal, statusVal) => {
    setWithdrawalsLoading(true);
    return axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/admin/withdrawals",
      data: { token, search: searchVal, statusFilter: statusVal },
    })
      .then((response) => {
        setWithdrawals(response.data.details || []);
      })
      .catch(() => toast.error("Failed to load withdrawal requests"))
      .finally(() => setWithdrawalsLoading(false));
  }, []);

  const loadPayments = useCallback((token, searchVal, statusVal) => {
    setPaymentsLoading(true);
    return axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/admin/payments",
      data: { token, search: searchVal, statusFilter: statusVal },
    })
      .then((response) => {
        setPayments(response.data.details || []);
      })
      .catch(() => toast.error("Failed to load payment submissions"))
      .finally(() => setPaymentsLoading(false));
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }

    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api",
      data: { token },
    })
      .then(async (response) => {
        if (response.data.role !== "admin") {
          toast.error("Admin access required");
          navigate("/");
          return;
        }
        await loadPendingProducts(token);
      })
      .catch(() => { toast.error("Please log in again"); navigate("/login"); })
      .finally(() => setLoading(false));
  }, [navigate, loadPendingProducts]);

  // Load all products when switching to that tab
  useEffect(() => {
    if (tab === "all") {
      loadAllProducts(getToken(), search, statusFilter);
    } else if (tab === "withdrawals") {
      loadWithdrawals(getToken(), withdrawalSearch, withdrawalStatusFilter);
    } else if (tab === "payments") {
      loadPayments(getToken(), paymentSearch, paymentStatusFilter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleReview = (productId, action) => {
    const token = getToken();
    const endpoint =
      action === "approve" ? "/api/admin/approve-product" : "/api/admin/reject-product";

    toast.loading("Processing", { duration: 1500 });
    axios({ method: "post", baseURL: `${process.env.REACT_APP_BASEURL}`, url: endpoint, data: { token, productId } })
      .then(() => {
        setPending((prev) => prev.filter((item) => (item.id || item._id) !== productId));
        toast.success(action === "approve" ? "Product approved" : "Product rejected");
      })
      .catch(() => toast.error("Action failed"));
  };

  const handleDelete = (productId) => {
    const token = getToken();
    toast.loading("Deleting...", { duration: 1500 });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/admin/delete-product",
      data: { token, productId },
    })
      .then(() => {
        setPending((prev) => prev.filter((item) => (item.id || item._id) !== productId));
        setAllItems((prev) => prev.filter((item) => (item.id || item._id) !== productId));
        setConfirmDelete(null);
        toast.success("Product deleted");
      })
      .catch(() => { setConfirmDelete(null); toast.error("Delete failed"); });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadAllProducts(getToken(), search, statusFilter);
  };

  const handleWithdrawalSearch = (e) => {
    e.preventDefault();
    loadWithdrawals(getToken(), withdrawalSearch, withdrawalStatusFilter);
  };

  const handleWithdrawalStatus = (withdrawalId, nextStatus) => {
    const token = getToken();
    toast.loading("Updating withdrawal...", { duration: 1400 });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/admin/withdrawals/update-status",
      data: { token, withdrawalId, status: nextStatus },
    })
      .then(() => {
        setWithdrawals((prev) =>
          prev.map((item) =>
            item.id === withdrawalId
              ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() }
              : item
          )
        );
        toast.success(`Withdrawal marked ${nextStatus}`);
      })
      .catch((error) => {
        const message = error?.response?.data?.message || "Failed to update withdrawal";
        toast.error(message);
      });
  };

  const handlePaymentSearch = (e) => {
    e.preventDefault();
    loadPayments(getToken(), paymentSearch, paymentStatusFilter);
  };

  const handlePaymentStatus = (paymentId, nextStatus) => {
    const token = getToken();
    toast.loading("Updating payment...", { duration: 1400 });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/payments/review",
      data: { token, paymentId, status: nextStatus, reviewNote: "Reviewed by admin" },
    })
      .then(() => {
        setPayments((prev) =>
          prev.map((item) =>
            item.id === paymentId
              ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() }
              : item
          )
        );
        toast.success(`Payment ${nextStatus}`);
      })
      .catch((error) => {
        const message = error?.response?.data?.message || "Failed to update payment";
        toast.error(message);
      });
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const statusBadge = (status) => {
    const s = status || "approved";
    const style = STATUS_COLORS[s] || STATUS_COLORS.approved;
    return (
      <span style={{ ...style, borderRadius: "999px", padding: "2px 10px", fontSize: "12px", fontWeight: 700, textTransform: "capitalize" }}>
        {s}
      </span>
    );
  };

  const getProductId = (item) => item?.id || item?._id;

  return (
    <div className={styles.adminPage}>
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <p>Are you sure you want to permanently delete this listing?</p>
            <div className={styles.modalActions}>
              <button className={styles.deleteBtn} onClick={() => handleDelete(confirmDelete)}>Yes, Delete</button>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.headerRow}>
        <h1>Admin Panel</h1>
        <div className={styles.navLinks}>
          <Link to="/">Home</Link>
          <Link to="/profile">Profile</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === "pending" ? styles.tabActive : styles.tab}
          onClick={() => setTab("pending")}
        >
          Pending Approvals {pending.length > 0 && <span className={styles.badge}>{pending.length}</span>}
        </button>
        <button
          type="button"
          className={tab === "all" ? styles.tabActive : styles.tab}
          onClick={() => setTab("all")}
        >
          All Listings
        </button>
        <button
          type="button"
          className={tab === "withdrawals" ? styles.tabActive : styles.tab}
          onClick={() => setTab("withdrawals")}
        >
          Withdrawals
        </button>
        <button
          type="button"
          className={tab === "payments" ? styles.tabActive : styles.tab}
          onClick={() => setTab("payments")}
        >
          Payments
        </button>
      </div>

      {loading ? (
        <div className={styles.loaderWrap}><LoaderIcon /></div>
      ) : tab === "pending" ? (
        <>
          {pending.length === 0 ? (
            <p>No pending products.</p>
          ) : (
            <div className={styles.listWrap}>
              {pending.map((item) => (
                <div key={getProductId(item)} className={styles.itemCard}>
                  <Link to={`/product/${getProductId(item)}`} className={styles.itemMain}>
                    <img src={item.pimage} alt={item.pname} />
                    <div>
                      <p className={styles.productName}>{item.pname}</p>
                      <p>Category: {item.pcat}</p>
                      <p>Price: ₱ {item.pprice}</p>
                      <p>Submitted: {item.preg?.slice(0, 10)}</p>
                    </div>
                  </Link>
                  <div className={styles.actionCol}>
                    <button type="button" onClick={() => handleReview(getProductId(item), "approve")} className={styles.approveBtn}>Approve</button>
                    <button type="button" onClick={() => handleReview(getProductId(item), "reject")} className={styles.rejectBtn}>Reject</button>
                    <button type="button" onClick={() => setConfirmDelete(getProductId(item))} className={styles.deleteBtn}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === "all" ? (
        <>
          {/* Search / filter bar */}
          <form className={styles.filterBar} onSubmit={handleSearch}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search by name or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.statusSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button type="submit" className={styles.searchBtn}>Search</button>
          </form>

          {allLoading ? (
            <div className={styles.loaderWrap}><LoaderIcon /></div>
          ) : allItems.length === 0 ? (
            <p>No products found.</p>
          ) : (
            <div className={styles.listWrap}>
              {allItems.map((item) => (
                <div key={getProductId(item)} className={styles.itemCard}>
                  <Link to={`/product/${getProductId(item)}`} className={styles.itemMain}>
                    <img src={item.pimage} alt={item.pname} />
                    <div>
                      <p className={styles.productName}>{item.pname}</p>
                      <p>Category: {item.pcat} &nbsp;{statusBadge(item.status)}</p>
                      <p>Price: ₱ {item.pprice}</p>
                      <p>Listed: {item.preg?.slice(0, 10)}</p>
                      {item.sold && <p style={{ color: "#6b7280" }}>Sold ✓</p>}
                    </div>
                  </Link>
                  <div className={styles.actionCol}>
                    <button type="button" onClick={() => setConfirmDelete(getProductId(item))} className={styles.deleteBtn}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === "withdrawals" ? (
        <>
          <form className={styles.filterBar} onSubmit={handleWithdrawalSearch}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search by seller name, email, or GCash number..."
              value={withdrawalSearch}
              onChange={(e) => setWithdrawalSearch(e.target.value)}
            />
            <select
              className={styles.statusSelect}
              value={withdrawalStatusFilter}
              onChange={(e) => setWithdrawalStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
            </select>
            <button type="submit" className={styles.searchBtn}>Search</button>
          </form>

          {withdrawalsLoading ? (
            <div className={styles.loaderWrap}><LoaderIcon /></div>
          ) : withdrawals.length === 0 ? (
            <p>No withdrawal requests found.</p>
          ) : (
            <div className={styles.listWrap}>
              {withdrawals.map((item) => {
                const canApprove = item.status === "pending";
                const canReject = item.status === "pending" || item.status === "approved";
                const canMarkPaid = item.status === "approved";

                return (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.itemMain}>
                      <div>
                        <p className={styles.productName}>{item.userName || "Seller"}</p>
                        <p>Email: {item.userMail}</p>
                        <p>GCash: {item.gcashNumber}</p>
                        <p>Amount: {formatCurrency(item.amount)} &nbsp;{statusBadge(item.status)}</p>
                        <p>Requested: {item.createdAt?.slice(0, 10)}</p>
                        {item.note ? <p>Note: {item.note}</p> : null}
                      </div>
                    </div>
                    <div className={styles.actionCol}>
                      <button
                        type="button"
                        onClick={() => handleWithdrawalStatus(item.id, "approved")}
                        className={styles.approveBtn}
                        disabled={!canApprove}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWithdrawalStatus(item.id, "paid")}
                        className={styles.paidBtn}
                        disabled={!canMarkPaid}
                      >
                        Mark Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWithdrawalStatus(item.id, "rejected")}
                        className={styles.rejectBtn}
                        disabled={!canReject}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <form className={styles.filterBar} onSubmit={handlePaymentSearch}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search by buyer, product, or reference..."
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
            />
            <select
              className={styles.statusSelect}
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button type="submit" className={styles.searchBtn}>Search</button>
          </form>

          {paymentsLoading ? (
            <div className={styles.loaderWrap}><LoaderIcon /></div>
          ) : payments.length === 0 ? (
            <p>No payment submissions found.</p>
          ) : (
            <div className={styles.listWrap}>
              {payments.map((item) => (
                <div key={item.id} className={styles.itemCard}>
                  <div className={styles.itemMain}>
                    {item.productImage ? <img src={item.productImage} alt={item.productName} /> : null}
                    <div>
                      <p className={styles.productName}>{item.productName || "Product"}</p>
                      <p>Buyer: {item.buyerName} ({item.buyerMail})</p>
                      <p>Seller: {item.sellerName} ({item.sellerMail})</p>
                      <p>Reference: {item.referenceNumber} &nbsp;{statusBadge(item.status)}</p>
                      <p>Amount: {formatCurrency(item.amount)}</p>
                      <p>Platform fee: {formatCurrency(item.platformFee)}</p>
                      <p>Seller net: {formatCurrency(item.sellerNet)}</p>
                      <p>Submitted: {item.createdAt?.slice(0, 10)}</p>
                      {item.receiptImage ? (
                        <a href={item.receiptImage} target="_blank" rel="noreferrer">View receipt</a>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.actionCol}>
                    <button
                      type="button"
                      onClick={() => handlePaymentStatus(item.id, "approved")}
                      className={styles.approveBtn}
                      disabled={item.status !== "pending"}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentStatus(item.id, "rejected")}
                      className={styles.rejectBtn}
                      disabled={item.status !== "pending"}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Admin;