import { useEffect, useState } from "react";
import styles from "./Profile.module.scss";
import { toast } from "react-hot-toast";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import dust from "../assets/dustbin.png";

function Profile() {
  const navigate = useNavigate();
  const [myProds, setMyProds] = useState(
    Array({
      id: "",
      pname: "",
      pprice: "",
      pimage: "",
      preg: "",
    })
  );
  const [myBids, setMyBids] = useState(
    Array({
      pname: "",
      pimage: "",
      bidPrice: "",
      bidtime: "",
      pprice: "",
      pid: "",
      bid: "",
    })
  );
  const [myPurchases, setMyPurchases] = useState(
    Array({
      id: "",
      pname: "",
      pprice: "",
      soldPrice: "",
      pimage: "",
      preg: "",
    })
  );
  const [logout, setLogout] = useState(false);
  const [del, setDelete] = useState(false);
  const [id, setId] = useState("");
  const [role, setRole] = useState("user");
  const [data, setData] = useState({
    name: "",
    mail: "",
    year: "",
    course: "",
    address: "",
    phone: "",
  });

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case "pending":
        return {
          background: "#fff7ed",
          color: "#c2410c",
        };
      case "rejected":
        return {
          background: "#fef2f2",
          color: "#b91c1c",
        };
      default:
        return {
          background: "#ecfdf5",
          color: "#047857",
        };
    }
  };

  const handleUpdate = () => {
    toast.loading("Processing", {
      duration: 5000,
    });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/update",
      data: { newData: data, id: id },
    })
      .then(function (response) {
        toast.success("Updated Successfully");
        window.location.reload(true);
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  const handleLogout = () => {
    setLogout(true);
  };

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("token"));
    if (token === "") {
      navigate("/");
    }
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api",
      data: { token: token },
    })
      .then(function (response) {
        const myid = response.data.userid;
        setId(myid);
        setRole(response.data.role || "user");
        axios({
          method: "post",
          baseURL: `${process.env.REACT_APP_BASEURL}`,
          url: "/api/profile",
          data: { id: myid },
        })
          .then((res) => {
            console.log(res);
            console.log(res.data);
            setData(res.data.data);
            setMyBids(res.data.mybids);
            setMyProds(res.data.myproducts);
            setMyPurchases(res.data.mypurchases || []);
          })
          .catch((err) => console.log(err));
      })
      .catch(function (error) {
        console.log(error);
      });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => {
      return { ...prev, [name]: value };
    });
  };

  const handleCancel = () => {
    setLogout(false);
    setDelete(false);
  };

  const handleDelete = () => {
    setDelete(true);
  };

  const handleLogoutAcc = () => {
    localStorage.setItem("token", JSON.stringify(""));
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/logout",
      data: { id: id },
    })
      .then((res) => {
        toast.success("Logged out successfully!");
        navigate("/");
      })
      .catch((err) => console.log(err));
  };

  const handleDeleteAcc = () => {
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/deleteAccount",
      data: { id: id },
    })
      .then(function (response) {
        localStorage.setItem("token", JSON.stringify(""));
        navigate("/");
      })
      .catch(function (error) {
        console.log(error);
      });
  };
  return (
    <div id={styles.profilePage}>
      <div id={styles.profileContainer}>
        <div
          id={styles.logoutblur}
          onClick={() => {
            setLogout(false);
            setDelete(false);
          }}
          style={logout || del ? { display: "block" } : { display: "none" }}
        />
        <div
          id={styles.logout}
          style={logout || del ? { display: "block" } : { display: "none" }}
        >
          <div id={styles.logoutTitle}>
            {del ? "Delete " : "Log out from "}your Account
          </div>
          <div id={styles.logoutContext}>
            Are you sure you want to{" "}
            {del ? "delete your account permanently?" : "logout?"}
          </div>
          <div id={styles.logoutBTNS}>
            <button onClick={handleCancel}>Cancel</button>
            <button onClick={logout ? handleLogoutAcc : handleDeleteAcc}>
              {del ? "Delete" : "Logout"}
            </button>
          </div>
        </div>

        <span id={styles.profileTitle}>
          <span>Profile</span>
          <Link to="/">{"<-"} back</Link>
        </span>
        <div className={styles.profileAttribute}>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={data.name}
            onChange={handleChange}
          />
        </div>
        <div className={styles.profileAttribute}>
          <label>Mail:</label>
          <input
            style={{ cursor: "not-allowed" }}
            name="mail"
            value={data.mail}
            defaultValue={data.mail}
          />
        </div>
        <div className={styles.profileAttribute}>
          <label>Year:</label>
          <input
            type="number"
            name="year"
            value={data.year}
            onChange={handleChange}
          />
        </div>
        <div className={styles.profileAttribute}>
          <label>Course:</label>
          <input
            type="text"
            name="course"
            value={data.course}
            onChange={handleChange}
          />
        </div>
        <div className={styles.profileAttribute}>
          <label>Address:</label>
          <input name="address" value={data.address} onChange={handleChange} />
        </div>
        <div className={styles.profileAttribute}>
          <label>Phone:</label>
          <input
            name="phone"
            type="number"
            value={data.phone}
            onChange={handleChange}
          />
        </div>
        <div id={styles.profileBtns}>
          <button type="button" onClick={handleUpdate}>
            Update
          </button>
          {role === "admin" ? (
            <button type="button" onClick={() => navigate("/admin")}>
              Admin Panel
            </button>
          ) : null}
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
          <button type="button" onClick={handleDelete}>
            Delete
          </button>
        </div>
        <div>
          <div className={styles.mybidtitle}>My Purchases</div>
          <div className={styles.mybidcontainer}>
            {myPurchases.length !== 0 ? (
              myPurchases.map((ele) => {
                return (
                  <div key={ele.id} className={styles.mybidele} style={{border: '2px solid #4caf50'}}>
                    <img src={ele.pimage} alt="" />
                    <div className={styles.mybidinform}>
                      <p className={styles.mybidname}>✓ {ele.pname}</p>
                      <p>purchased on : {ele.preg.slice(0, 10)}</p>
                      <p>
                        your bid : ₱ {ele.soldPrice} /- , original price : ₱{" "}
                        {ele.pprice} /-
                      </p>
                      <p style={{color: '#4caf50', fontWeight: 'bold'}}>Your bid was accepted! 🎉</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <></>
            )}
          </div>
        </div>
        <div>
          <div className={styles.mybidtitle}>My Bids</div>
          <div className={styles.mybidcontainer}>
            {myBids.length !== 0 ? (
              myBids.map((ele) => {
                return (
                  <div key={ele.pname} className={styles.mybidele}>
                    <img src={ele.pimage} alt="" />
                    <div className={styles.mybidinform}>
                      <p className={styles.mybidname}>{ele.pname}</p>
                      <p>bidded on : {ele.bidtime.slice(0, 10)}</p>
                      <p>
                        bid price : ₱ {ele.bidPrice} /- , product price : ₱{" "}
                        {ele.pprice} /-
                      </p>
                    </div>
                    <div
                      className={styles.mybidx}
                      onClick={(e) => {
                        toast.loading("Processing", { duration: 2000 });
                        axios({
                          method: "post",
                          baseURL: `${process.env.REACT_APP_BASEURL}`,
                          url: "/api/deletemybid",
                          data: { pid: ele.pid, bid: ele.bid },
                        })
                          .then((res) => {
                            toast.success("Bid deleted successfully!");
                          })
                          .catch((err) => console.log(err));
                      }}
                    >
                      <img src={dust} alt="" />
                    </div>
                  </div>
                );
              })
            ) : (
              <></>
            )}
          </div>
        </div>
        <div>
          <div className={styles.mybidtitle}>My Products</div>
          <div className={styles.mybidcontainer}>
            {myProds.length !== 0 ? (
              myProds.map((ele) => {
                const productStatus = ele.status || "approved";
                return (
                  <div key={ele.pname} className={styles.mybidele}>
                    <Link
                      to={`/product/${ele.id}`}
                      className="flex flex-row items-center"
                    >
                      <img src={ele.pimage} alt="" />
                      <div className={styles.mybidinform}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <p className={styles.mybidname}>{ele.pname}</p>
                          <span
                            style={{
                              ...getStatusBadgeStyle(productStatus),
                              borderRadius: "999px",
                              padding: "4px 10px",
                              fontSize: "12px",
                              fontWeight: 700,
                              textTransform: "capitalize",
                            }}
                          >
                            {productStatus}
                          </span>
                        </div>
                        <p>registered on : {ele.preg.slice(0, 10)}</p>
                        <p>price : ₱ {ele.pprice}</p>
                        {productStatus === "pending" ? (
                          <p style={{ color: "#c2410c", fontWeight: 600 }}>
                            Waiting for admin approval before it appears on the site.
                          </p>
                        ) : productStatus === "rejected" ? (
                          <p style={{ color: "#b91c1c", fontWeight: 600 }}>
                            This listing was rejected and is hidden from buyers.
                          </p>
                        ) : null}
                      </div>
                    </Link>
                    <div
                      className={styles.mybidx}
                      onClick={(e) => {
                        axios({
                          method: "post",
                          baseURL: `${process.env.REACT_APP_BASEURL}`,
                          url: "/api/deletemyprod",
                          data: { pid: ele.id },
                        })
                          .then((res) => {
                            toast.success("Product deleted successfully!");
                            window.location.reload();
                          })
                          .catch((err) => console.log(err));
                      }}
                    >
                      <img src={dust} alt="" />
                    </div>
                  </div>
                );
              })
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
