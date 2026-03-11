import styles from "./Home.module.scss";
import { Link } from "react-router-dom";
import search from "../assets/search.svg";
import table from "../assets/table.svg";
import cycle from "../assets/cycle.svg";
import setsquare from "../assets/setsquare.svg";
import chair from "../assets/chair.svg";
import coat from "../assets/coat.svg";
import others from "../assets/others.svg";
import all from "../assets/all.svg";
import { useEffect, useState } from "react";
import axios from "axios";
import Card from "../components/Card/Card";
import { LoaderIcon, toast } from "react-hot-toast";

function Home() {
  console.log("Home component rendering...");
  const [loading, setLoading] = useState(true);
  const [searchval, setsearchval] = useState("");
  const [allProd, setAllProd] = useState([]);
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
  const [disProd, setDisProd] = useState([]);
  const [valid, setValid] = useState(false);
  useEffect(() => {
    console.log("useEffect running, REACT_APP_BASEURL:", process.env.REACT_APP_BASEURL);
    try {
      const tokenStr = localStorage.getItem("token");
      console.log("Token from localStorage:", tokenStr);
      const token = tokenStr ? JSON.parse(tokenStr) : null;
      
      if (token) {
        axios({
          method: "post",
          baseURL: `${process.env.REACT_APP_BASEURL}`,
          url: "/api",
          data: { token: token },
        })
          .then(function (response) {
            console.log("Token validation successful");
            setValid(true);
            setNotificationData(response.data.allNotifications);
            console.log(response.data.allNotifications);
          })
          .catch(function (error) {
            console.log("Token validation error:", error);
            console.log("error caught in frontend from backend");
          });
      } else {
        console.log("No token found, user not logged in");
      }
    } catch (err) {
      console.error("Error parsing token:", err);
    }
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/allprod",
      data: {},
    })
      .then(function (response) {
        console.log("Products loaded:", response.data.details.length, "items");
        setAllProd(response.data.details);
        setDisProd(response.data.details);
        setLoading(false);
      })
      .catch(function (error) {
        console.log("ERROR loading products:", error);
        toast.error("Failed to load products");
        setLoading(false);
        console.log("error caught in frontend from backend");
      });
  }, []);

  const colorArray = [
    "#000080",
    "#000080",
    "#000080",
    "#000080",
    "#000080",
  ];
  const [notification, setNotification] = useState(false);
  const images = [table, chair, cycle, setsquare, coat, others, all];
  const [category, setCategory] = useState("all");
  const catId = ["Gadgets", "Books", "Clothes", "Supplies", "Food", "Others", "All"];
  const handleSearch = () => {
    const query = searchval.trim();
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/searchproduct",
      data: { searchval: query },
    })
      .then(function (response) {
        setAllProd(response.data.mysearchdata);
        setDisProd(response.data.mysearchdata);
      })
      .catch(function (error) {
        toast.error("Internal Error");
        console.log(error);
      });
  };
  const handleDisProd = (id) => {
    if (id === "All" || id === "all") {
      setDisProd(allProd);
      return;
    }
    const result = [];
    allProd.forEach((ele) => {
      if (ele.pcat === id) {
        result.push(ele);
      }
    });
    setDisProd(result);
  };
  return (
    <>
      <nav id={styles.navbar}>
        <div id={styles.navLogo}>Unimarket</div>
        {valid ? (
          <div id={styles.navLinks}>
            <div
              onClick={() => {
                setNotification(!notification);
              }}
            >
              Notification
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
      <div id="home" className={styles.homePage}>
        <div id={styles.hero}>
          <h1>Find great deals on campus</h1>
          <p>Search books, bikes, supplies, and more from fellow students.</p>
          <div className={styles.heroSearch}>
            <input
              value={searchval}
              onChange={(e) => {
                const val = e.target.value;
                setsearchval(val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="Search for anything..."
            />
            <span
              onClick={() => {
                handleSearch();
              }}
            >
              <img src={search} alt="search" />
            </span>
          </div>
        </div>

        <div id={styles.categoriesRow}>
          {images.map((element, index) => {
            return (
              <div
                key={index}
                className={styles.categoryChip}
                onClick={() => {
                  const id = catId[index];
                  setCategory(id);
                  handleDisProd(id);
                }}
              >
                <img src={images[index]} alt={`${images[index]}`} />
                <span>{catId[index]}</span>
              </div>
            );
          })}
        </div>
        {loading ? (
          <div className={styles.loadingIc}>
            <LoaderIcon />
          </div>
        ) : (
          <div id={styles.products}>
            {disProd.map((element, index) => {
              return (
                <Card
                  key={index}
                  ele={element}
                />
              );
            })}
          </div>
        )}
      </div>
      {notification && valid && (
        <>
          <div className={styles.bgNotification} onClick={() => setNotification(false)}></div>
          <div className={styles.notificationContainer}>
            <div className={styles.notificationHeader}>
              <h3>Bid Notifications</h3>
              <button 
                onClick={() => setNotification(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </div>
            {notificationData.length > 0 ? (
              <div className={styles.notificationList}>
                {notificationData.map((element, index) => {
                  return (
                    <div key={index} className={styles.notification}>
                  <div className={styles.notificationText}>
                    <p>
                      Someone bid on your product{" "}
                      <span style={{ fontWeight: "bold" }}>
                        {element.pname}
                      </span>{" "}
                      for ₱{element.bprice}
                    </p>
                  </div>
                  <div className={styles.notificationButtons}>
                    <button
                      onClick={() => {
                        axios({
                          method: "post",
                          baseURL: `${process.env.REACT_APP_BASEURL}`,
                          url: "/api/acceptbid",
                          data: {
                            prodId: element.prodId,
                            buyer: element.bid,
                            bprice: element.bprice,
                          },
                        })
                          .then(function (response) {
                            toast.success("Bid accepted! Product marked as sold.");
                            setNotification(false);
                            // Refresh the page to remove sold product from listings
                            window.location.reload();
                          })
                          .catch(function (error) {
                            toast.error("Error accepting bid");
                            console.log(error);
                          });
                      }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => {
                        axios({
                          method: "post",
                          baseURL: `${process.env.REACT_APP_BASEURL}`,
                          url: "/api/rejectbid",
                          data: {
                            prodId: element.prodId,
                            buyer: element.bid,
                          },
                        })
                          .then(function (response) {
                            toast.success("Bid rejected!");
                            setNotification(false);
                            window.location.reload();
                          })
                          .catch(function (error) {
                            toast.error("Error rejecting bid");
                            console.log(error);
                          });
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
                })}
              </div>
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>No notifications</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default Home;
