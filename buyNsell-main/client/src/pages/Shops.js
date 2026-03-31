import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { LoaderIcon, toast } from "react-hot-toast";
import styles from "./Shops.module.scss";

function Shops() {
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState([]);

  useEffect(() => {
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/shops",
      data: {},
    })
      .then((response) => {
        setShops(response.data.shops || []);
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        toast.error("Failed to load verified shops");
        setLoading(false);
      });
  }, []);

  return (
    <div className={styles.shopsPage}>
      <div className={styles.headerRow}>
        <h1>Verified Shops</h1>
        <Link to="/" className={styles.backLink}>Back to Home</Link>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}><LoaderIcon /></div>
      ) : shops.length === 0 ? (
        <div className={styles.emptyState}>No verified shops found yet.</div>
      ) : (
        <div className={styles.shopList}>
          {shops.map((shop) => (
            <section key={shop.sellerId} className={styles.shopCard}>
              <div className={styles.shopHeader}>
                <div>
                  <h2>
                    {shop.name}
                    {shop.sellerVerified ? <span className={styles.verifiedBadge}>✓ Verified Shop</span> : null}
                  </h2>
                  <p>{shop.mail}</p>
                </div>
                <div className={styles.ratingBadge}>
                  ★ {Number(shop.sellerRating || 0).toFixed(1)} ({shop.sellerRatingCount})
                </div>
              </div>

              {shop.products.length === 0 ? (
                <p className={styles.emptyProducts}>No active listings from this shop right now.</p>
              ) : (
                <div className={styles.productGrid}>
                  {shop.products.map((product) => (
                    <Link key={product.id} to={`/product/${product.id}`} className={styles.productCard}>
                      <img src={product.pimage} alt={product.pname} />
                      <div>
                        <p className={styles.productName}>{product.pname}</p>
                        <p className={styles.productMeta}>{product.pcat}</p>
                        <p className={styles.productPrice}>₱ {product.pprice}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default Shops;
