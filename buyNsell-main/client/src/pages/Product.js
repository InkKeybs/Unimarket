import React, { useState } from "react";
import { useEffect } from "react";
import styles from "./Product.module.scss";
import axios from "axios";
import { Link } from "react-router-dom";
import search from "../assets/search.svg";
import { LoaderIcon, toast } from "react-hot-toast";

function Product() {
  const [notification, setNotification] = useState(false);
  const [exist, setExist] = useState(false);
  const [addBid, setAddBid] = useState(false);
  const [bidAmount, setbidAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prodExist, setProdExist] = useState(false);
  const [id, setId] = useState("");
  const [isMyProd, setIsMyProd] = useState(false);
  const [valid, setValid] = useState(false);
  const [sname, setSname] = useState("");
  const [smail, setSmail] = useState("");
  const [sphone, setPhone] = useState("");
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
  const [bid, setBid] = useState({
    prodId: "",
    sellerId: "",
    bids: {
      buyerId: "",
      bidPrice: 0,
      bidTime: Date(),
      regno: 411212,
      cancel: false,
    },
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
    const href = window.location.href.split("/");
    const ppid = href[href.length - 1];
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
          data: { id: ppid },
        })
          .then(function (response) {
            console.log("SETID22");
            console.log(response.data.details.data);
            var flag = false;
            console.log("eed ", response.data.details.data.id.toString(), myid);

            if (response.data.details.data.id.toString() === myid) {
              setIsMyProd(true);
            } else {
              setIsMyProd(false);
            }
            if (response.data.details.bid) {
              for (let u = 0; u < response.data.details.bid.bids.length; u++) {
                console.log(response.data.details.bid.bids[u].buyerId, myid);
                if (
                  response.data.details.bid.bids[u].buyerId.toString() === myid
                ) {
                  flag = true;
                  break;
                }
              }

              setExist(flag);
              setBid(response.data.details.bid);
            }
            setData(response.data.details.data);
            setSname(response.data.details.name);
            setSmail(response.data.details.mail);
            setPhone(response.data.details.phone);
            setbidAmount(data.pprice);
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
      data: { id: ppid },
    })
      .then(function (response) {
        console.log("SETID22");
        console.log(response.data.details.data);
        var flag = false;
        console.log("eed ", response.data.details.data.id.toString(), id);

        if (response.data.details.data.id.toString() === id) {
          setIsMyProd(true);
        } else {
          setIsMyProd(false);
        }
        if (response.data.details.bid) {
          for (let u = 0; u < response.data.details.bid.bids.length; u++) {
            console.log(response.data.details.bid.bids[u].buyerId, data.id);
            if (
              response.data.details.bid.bids[u].buyerId.toString() === data.id
            ) {
              flag = true;
              return;
            }
          }

          setExist(flag);
          setBid(response.data.details.bid);
        }
        setData(response.data.details.data);
        setSname(response.data.details.name);
        setSmail(response.data.details.mail);
        setbidAmount(data.pprice);
        setLoading(false);
        setProdExist(true);
      })
      .catch(function (error) {
        setLoading(false);
        console.log(error);
      });
  }, []);

  const handleAddBid = () => {
    if (bidAmount < data.pprice) {
      toast.error("Bid Amount cannot be less than product price");
      return;
    }
    const maxBid = data.pprice * 1.1; // 10% above original price
    if (bidAmount > maxBid) {
      toast.error(`Bid cannot exceed 10% above the original price (₱${maxBid.toFixed(2)})`);
      return;
    }
    toast.loading("Processing", {
      duration: 3000,
    });
    setAddBid(false);
    const today = new Date();
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/addbid",
      data: {
        biddata: {
          buyerId: id,
          bidPrice: bidAmount,
          sellerId: data.id,
          pid: data._id,
          bidTime: today,
          cancel: false,
        },
      },
    })
      .then(function (response) {
        var flag = false;
        if (response.data.details.bid) {
          response.data.details.bid.bids.forEach((element) => {
            console.log(element.buyerId, data.id);
            if (element.buyerId === id) {
              flag = true;
              return;
            }
          });
          setExist(flag);
          console.log(response.data.details.bid);
          setBid(response.data.details.bid);
          toast.success("Bid added successfully");
        }
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  const handleRemoveBid = () => {
    toast.loading("Processing", {
      duration: 2000,
    });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/removebid",
      data: { productid: data._id, buyerId: id },
    })
      .then(function (response) {
        var flag = false;
        toast.success("Removed Bid Successfully");
        if (response.data.details.bid) {
          response.data.details.bid.bids.forEach((element) => {
            if (element.buyerId === id) {
              flag = true;
              return;
            }
          });
          setExist(flag);
          setBid(response.data.details.bid);
        }
      })
      .catch(function (error) {
        console.log(error);
      });
  };

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
      {addBid ? (
        <>
          <div
            id={styles.backgroundaddbid}
            onClick={() => {
              setAddBid(false);
            }}
          />
          <div id={styles.addbid}>
            <p>Add Bid</p>
            <input
              type="number"
              id={styles.bidInput}
              min={bidAmount}
              value={bidAmount}
              onChange={(e) => {
                setbidAmount(e.target.value);
              }}
            ></input>
            <div className="flex flex-row justify-evenly">
              <button
                onClick={() => {
                  setAddBid(false);
                }}
              >
                Cancel
              </button>
              <button onClick={handleAddBid}>Add</button>
            </div>
          </div>
        </>
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
          <div id={styles.productInformation}>
            <div id={styles.imageContainer}>
              <img src={data.pimage} id={styles.pimage} alt={data.pname} />
            </div>
            <div id={styles.productInfocon}>
              <div>
                <p id={styles.pname}>{data.pname}</p>
                <p id={styles.pcat}> {data.pcat}</p>
                <p id={styles.pdetail}>{data.pdetail}</p>
                <p className={styles.pbought}>
                  bought on : {data.pdate.slice(0, 10)}
                </p>
                <p className={styles.pbought}>
                  sold by : {sname} {valid ? smail : ""}
                </p>
                {valid ? (
                  <p className={styles.pbought}>phone : {sphone}</p>
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
                    <div></div>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                      {!exist ? (
                        <button
                          className={styles.addBidButton}
                          onClick={() => {
                            setAddBid(true);
                          }}
                        >
                          Add bid
                        </button>
                      ) : (
                        <button
                          onClick={handleRemoveBid}
                          className={styles.addBidButton}
                        >
                          Remove bid
                        </button>
                      )}
                      <button
                        className={styles.chatButton}
                        onClick={() => {
                          if (window.openChatWidget) {
                            window.openChatWidget(data._id, data.id, data.pname, sname);
                          }
                        }}
                      >
                        💬 Chat with Seller
                      </button>
                    </div>
                  )
                ) : (
                  <p>login to add bid</p>
                )}
              </div>
            </div>
          </div>
          <div id={styles.bidtable}>
            <p className={styles.activebidstitle}>Active Bids</p>
            <div className={styles.bidData}>
              <div className={styles.bidheading}>
                <p>Regno.</p>
                <p>Date</p>
                <p>Price</p>
              </div>
              {bid.sellerId !== "" ? (
                <div style={{ marginBottom: "20px" }}>
                  {bid.bids.map((ele, ind) => {
                    if (isMyProd) {
                      return (
                        <Link
                          key={ind}
                          to={`/buy-product/${bid.prodId}/${bid.sellerId}/${ele.buyerId}`}
                          className={styles.bidheading}
                        >
                          <p
                            style={{ background: "rgba(128, 128, 128, 0.022)" }}
                          >
                            {ele.regno}
                          </p>
                          <p
                            style={{
                              background: "rgba(128, 128, 128, 0.022)",
                            }}
                          >
                            {ele.bidTime.slice(0, 10)}
                          </p>
                          <p
                            style={{ background: "rgba(128, 128, 128, 0.022)" }}
                          >
                            {ele.bidPrice}
                          </p>
                        </Link>
                      );
                    }
                    return (
                      <div key={ind} className={styles.bidheading}>
                        <p style={{ background: "rgba(128, 128, 128, 0.022)" }}>
                          {ele.regno}
                        </p>
                        <p
                          style={{
                            background: "rgba(128, 128, 128, 0.022)",
                          }}
                        >
                          {ele.bidTime.slice(0, 10)}
                        </p>
                        <p style={{ background: "rgba(128, 128, 128, 0.022)" }}>
                          {ele.bidPrice}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div id={styles.noBids}>No Bids made so far</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default Product;
