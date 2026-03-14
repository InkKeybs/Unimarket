import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { LoaderIcon, toast } from "react-hot-toast";
import styles from "./Admin.module.scss";

function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const loadPendingProducts = (token) => {
    return axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/admin/pending-products",
      data: { token },
    }).then((response) => {
      setItems(response.data.details || []);
    });
  };

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("token"));
    if (!token) {
      navigate("/login");
      return;
    }

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
      .catch(() => {
        toast.error("Please log in again");
        navigate("/login");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  const handleReview = (productId, action) => {
    const token = JSON.parse(localStorage.getItem("token"));
    const endpoint =
      action === "approve"
        ? "/api/admin/approve-product"
        : "/api/admin/reject-product";

    toast.loading("Processing", { duration: 1500 });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: endpoint,
      data: { token, productId },
    })
      .then(() => {
        setItems((prev) => prev.filter((item) => item._id !== productId));
        toast.success(action === "approve" ? "Product approved" : "Product rejected");
      })
      .catch(() => {
        toast.error("Action failed");
      });
  };

  return (
    <div className={styles.adminPage}>
      <div className={styles.headerRow}>
        <h1>Admin Panel</h1>
        <div className={styles.navLinks}>
          <Link to="/">Home</Link>
          <Link to="/profile">Profile</Link>
        </div>
      </div>

      <h2>Pending Product Approvals</h2>

      {loading ? (
        <div className={styles.loaderWrap}>
          <LoaderIcon />
        </div>
      ) : items.length === 0 ? (
        <p>No pending products.</p>
      ) : (
        <div className={styles.listWrap}>
          {items.map((item) => {
            return (
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
                  <button
                    type="button"
                    onClick={() => handleReview(item._id, "approve")}
                    className={styles.approveBtn}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(item._id, "reject")}
                    className={styles.rejectBtn}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Admin;