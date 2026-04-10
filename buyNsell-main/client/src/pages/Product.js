import React, { useState } from "react";
import { useEffect } from "react";
import styles from "./Product.module.scss";
import axios from "axios";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import search from "../assets/search.svg";
import { LoaderIcon, toast } from "react-hot-toast";

function Product() {
  const { prod: routeProductId } = useParams();
  const [notification, setNotification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prodExist, setProdExist] = useState(false);
  const [id, setId] = useState("");
  const [isMyProd, setIsMyProd] = useState(false);
  const [valid, setValid] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [sname, setSname] = useState("");
  const [smail, setSmail] = useState("");
  const [sphone, setPhone] = useState("");
  const [sellerVerified, setSellerVerified] = useState(false);
  const [sellerRating, setSellerRating] = useState(0);
  const [sellerRatingCount, setSellerRatingCount] = useState(0);
  const [data, setData] = useState({
    sname: "",
    _id: "314",
    id: "",
    sellerId: "",
    pname: "NAME",
    pprice: 0,
    pdetail:
      "KSEMFJKLERFN OEJFOEJFEF:E FO JFEHFUIFHFUIFYEFNIUFY ksffnrnfk shurf smfifr n0f jhuf fbf iufefnviu fn  yvyrvrjhg iurfhr wjhrwuifrwu fhrwif yfk viyrbyurwnrkjh rwif ryw rifrwhuivwr iwrfhoqo eldmnkdjcalefn vourlksfnvuhf h feuf fnejf hiqjdnkehfean kjiofjeafjief oefeijf ",
    pdate: "2020-20-20",
    pimage: "HI",
    pcat: "CYCLE",
    preg: "2932-23-21",
    __v: 0,
  });
  const [notificationData, setNotificationData] = useState(
    Array({
      prodId: "",
      href: "",
      imageURL: "",
      reg: 0,
      pname: "",
      bprice: 0,
      cancel: false,
      bid: "",
    })
  );

  useEffect(() => {
    const ppid = routeProductId;
    const token = JSON.parse(localStorage.getItem("token"));

    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api",
      data: { token: token },
    })
      .then(function (response) {
        console.log("SETID", response.data.userid);
        const myid = response.data.userid;
        setId(myid);
        console.log(id);
        setValid(true);
        axios({
          method: "post",
          baseURL: `${process.env.REACT_APP_BASEURL}`,
          url: "/api/prodData",
          data: { id: ppid, token: token },
        })
          .then(function (response) {
            console.log("SETID22");
            console.log(response.data.details.data);
            const productData = response.data.details.data;
            const sellerId = productData.seller_id || productData.sellerId || productData.id;
            console.log("eed ", sellerId?.toString?.(), myid);

            if (sellerId?.toString?.() === myid) {
              setIsMyProd(true);
            } else {
              setIsMyProd(false);
            }
            setData(response.data.details.data);
            setSname(response.data.details.name);
            setSmail(response.data.details.mail);
            setPhone(response.data.details.phone);
            setSellerVerified(Boolean(response.data.details.sellerVerified));
            setSellerRating(Number(response.data.details.sellerRating || 0));
            setSellerRatingCount(Number(response.data.details.sellerRatingCount || 0));
            if (productData.expires_at || productData.expiresAt) {
              setExpiresAt(new Date(productData.expires_at || productData.expiresAt));
            }
            setIsExpired(response.data.isExpired || false);
            setLoading(false);
            setProdExist(true);
          })
          .catch(function (error) {
            setLoading(false);
            console.log(error);
          });
        setNotificationData(response.data.allNotifications);
      })
      .catch((err) => {
        console.log(err);
        setValid(false);
      });

    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/prodData",
      data: { id: ppid, token: token },
    })
      .then(function (response) {
        console.log("SETID22");
        console.log(response.data.details.data);
        const productData = response.data.details.data;
        const sellerId = productData.seller_id || productData.sellerId || productData.id;
        console.log("eed ", sellerId?.toString?.(), id);

        if (sellerId?.toString?.() === id) {
          setIsMyProd(true);
        } else {
          setIsMyProd(false);
        }
        setData(response.data.details.data);
        setSname(response.data.details.name);
        setSmail(response.data.details.mail);
        setSellerVerified(Boolean(response.data.details.sellerVerified));
        setSellerRating(Number(response.data.details.sellerRating || 0));
        setSellerRatingCount(Number(response.data.details.sellerRatingCount || 0));
        setLoading(false);
        setProdExist(true);
      })
      .catch(function (error) {
        setLoading(false);
        console.log(error);
      });
  }, []);

  return (
    <>
      {notification ? (
        notificationData.length === 0 ? (
          <>
            <div className={styles.noNotificationContainer}>
              No Notifications
            </div>
            <div
              className={styles.bgNotification}
              onClick={() => {
                setNotification(false);
              }}
            />
          </>
        ) : (
          <>
            <div className={styles.notificationContainer}>
              {notificationData.map((ele) => {
                return (
                  <div className="flex flex-row">
                    <Link
                      key={ele.prodId}
                      to={ele.href}
                      className={styles.notifEl}
                    >
                      <img src={ele.imageURL} alt="product" />

                      <p>
                        {ele.reg} wants to buy your {ele.pname} for ₱{" "}
                        {ele.bprice}
                      </p>
                    </Link>
                    <button
                      className={styles.crossNotifi}
                      value={`${ele.prodId}-${ele.bid}`}
                      onClick={(e) => {
                        const data = e.target.value.split("-");
                        console.log("NETETR");
                        setNotification(false);
                        const prodid = data[0];
                        const bid = data[1];
                        toast.loading("Processing", { duration: 2000 });
                        toast.success("Removed notification successfully");
                        axios({
                          method: "post",
                          baseURL: `${process.env.REACT_APP_BASEURL}`,
                          url: "/api/cancelnotification",
                          data: { prodid, bid },
                        })
                          .then(function (response) {
                            setNotificationData(response.data.allNotifications);
                          })
                          .catch(function (error) {
                            toast.error("Internal Error");
                            console.log(error);
                          });
                      }}
                    >
                      X
                    </button>
                  </div>
                );
              })}
            </div>
            <div
              className={styles.bgNotification}
              onClick={() => {
                setNotification(false);
              }}
            />
          </>
        )
      ) : (
        ""
      )}
      <nav id={styles.navbar}>
        <div id={styles.navLogo}>Unimarket</div>
        <div id={styles.searchBox}>
          <input placeholder="I am looking for ..." />
          <span>
            <img src={search} alt="search" />
          </span>
        </div>
        {valid ? (
          <div id={styles.navLinks}>
            <div
              onClick={() => {
                setNotification((prev) => !prev);
              }}
              style={{ cursor: "pointer" }}
            >
              Notification
            </div>
            <div>
              <Link to="/chats">Chats</Link>
            </div>
            <div>
              <Link to="/sell">Sell</Link>
            </div>
            <div>
              <Link id={styles.registerNav} to="/profile">
                Profile
              </Link>
            </div>
          </div>
        ) : (
          <div id={styles.navLinks}>
            <div>
              <Link to="/login">Login</Link>
            </div>
            <div>
              <Link id={styles.registerNav} to="/register">
                Register
              </Link>
            </div>
          </div>
        )}
      </nav>
      {loading ? (
        <div className={styles.loadingIcon}>
          <LoaderIcon />
        </div>
      ) : !prodExist ? (
        <div className={styles.loadingIcon}>
          404 Error | Product Doesn&apos;t exist
        </div>
      ) : (
        <>
          <Link to="/" className={styles.backArrow}>← Back</Link>
          {expiresAt && (() => {
            const now = new Date();
            const msLeft = expiresAt - now;
            const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
            if (isExpired || daysLeft <= 0) {
              return (
                <div className={`${styles.expiryAlert} ${styles.expired}`}>
                  ⚠️ This listing has expired and is no longer active.
                </div>
              );
            }
            if (daysLeft <= 7) {
              return (
                <div className={`${styles.expiryAlert} ${styles.warning}`}>
                  ⏰ This listing expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}.
                </div>
              );
            }
            return null;
          })()}
          <div id={styles.productInformation}>
            <div id={styles.imageContainer}>
              <img src={data.pimage} id={styles.pimage} alt={data.pname} />
            </div>
            <div id={styles.productInfocon}>
              <div className={styles.productMetaBlock}>
                <p id={styles.pname}>{data.pname}</p>
                <p id={styles.pcat}> {data.pcat}</p>
                <p id={styles.pdetail}>{data.pdetail}</p>
                <p className={styles.metaLine}>
                  condition : {data.pcondition || "Used"}
                </p>
                <p className={styles.metaLine}>
                  bought on : {data.pdate.slice(0, 10)}
                </p>
                <p className={styles.metaLine}>
                  sold by : {sname} {valid ? smail : ""}
                </p>
                {(sellerVerified || sellerRatingCount > 0) && (
                  <div className={styles.sellerTrustRow}>
                    {sellerVerified && (
                      <span className={styles.verifiedBadge}>✓ Verified Seller</span>
                    )}
                    {sellerRatingCount > 0 && (
                      <span className={styles.ratingBadge}>
                        ★ {sellerRating.toFixed(1)} ({sellerRatingCount})
                      </span>
                    )}
                  </div>
                )}
                {valid ? (
                  <p className={styles.metaLine}>phone : {sphone}</p>
                ) : (
                  ""
                )}
              </div>
              <div className={styles.pricecon}>
                <div id={styles.pprice}>₱{data.pprice}/-</div>
                {loading ? (
                  <LoaderIcon />
                ) : valid ? (
                  isMyProd ? (
                    <div className={styles.ownerPill}>Your listing</div>
                  ) : (
                    <div className={styles.actionStack}>
                      <button
                        className={styles.chatButton}
                        onClick={() => {
                          if (window.openChatWidget) {
                            const chatProductId = data.id || data._id;
                            const chatSellerId = data.seller_id || data.sellerId;
                            if (!chatProductId || !chatSellerId) {
                              toast.error("Unable to open chat for this product right now");
                              return;
                            }
                            window.openChatWidget(chatProductId, chatSellerId, data.pname, sname, data.pimage);
                          }
                        }}
                      >
                        Chat with Seller
                      </button>
                      <Link
                        to={`/gcash-checkout/${data.id || data._id}`}
                        state={{
                          product: {
                            id: data.id || data._id,
                            pname: data.pname,
                            pprice: data.pprice,
                            pimage: data.pimage,
                            sellerId: data.seller_id || data.sellerId,
                            sellerName: sname,
                            sellerMail: smail,
                          },
                        }}
                        className={styles.gcashButton}
                      >
                        Pay with GCash
                      </Link>
                    </div>
                  )
                ) : (
                  <p>Login to chat or pay with GCash</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default Product;
