import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { LoaderIcon, toast } from "react-hot-toast";
import styles from "./Admin.module.scss";

const STATUS_COLORS = {
  pending:  { background: "#fff7ed", color: "#c2410c" },
  approved: { background: "#ecfdf5", color: "#047857" },
  rejected: { background: "#fef2f2", color: "#b91c1c" },
};

function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending"); // "pending" | "all"

  // --- Pending tab state ---
  const [pending, setPending] = useState([]);

  // --- All listings tab state ---
  const [allLoading, setAllLoading] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // productId waiting for confirm

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
        setPending((prev) => prev.filter((item) => item._id !== productId));
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
        setPending((prev) => prev.filter((item) => item._id !== productId));
        setAllItems((prev) => prev.filter((item) => item._id !== productId));
        setConfirmDelete(null);
        toast.success("Product deleted");
      })
      .catch(() => { setConfirmDelete(null); toast.error("Delete failed"); });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadAllProducts(getToken(), search, statusFilter);
  };

  const statusBadge = (status) => {
    const s = status || "approved";
    const style = STATUS_COLORS[s] || STATUS_COLORS.approved;
    return (
      <span style={{ ...style, borderRadius: "999px", padding: "2px 10px", fontSize: "12px", fontWeight: 700, textTransform: "capitalize" }}>
        {s}
      </span>
    );
  };

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
                <div key={item._id} className={styles.itemCard}>
                  <Link to={`/product/${item._id}`} className={styles.itemMain}>
                    <img src={item.pimage} alt={item.pname} />
                    <div>
                      <p className={styles.productName}>{item.pname}</p>
                      <p>Category: {item.pcat}</p>
                      <p>Price: ₱ {item.pprice}</p>
                      <p>Submitted: {item.preg?.slice(0, 10)}</p>
                    </div>
                  </Link>
                  <div className={styles.actionCol}>
                    <button type="button" onClick={() => handleReview(item._id, "approve")} className={styles.approveBtn}>Approve</button>
                    <button type="button" onClick={() => handleReview(item._id, "reject")} className={styles.rejectBtn}>Reject</button>
                    <button type="button" onClick={() => setConfirmDelete(item._id)} className={styles.deleteBtn}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
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
                <div key={item._id} className={styles.itemCard}>
                  <Link to={`/product/${item._id}`} className={styles.itemMain}>
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
                    <button type="button" onClick={() => setConfirmDelete(item._id)} className={styles.deleteBtn}>Delete</button>
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