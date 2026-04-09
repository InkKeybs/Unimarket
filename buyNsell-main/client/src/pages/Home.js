import styles from "./Home.module.scss";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  console.log("Home component rendering...");
  const [loading, setLoading] = useState(true);
  const [searchval, setsearchval] = useState("");
  const [allProd, setAllProd] = useState([]);
  const [disProd, setDisProd] = useState([]);
  const [valid, setValid] = useState(false);
  const [role, setRole] = useState("user");
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
            setRole(response.data.role || "user");
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
            <div>
              <Link to="/shops" className={styles.shopsPill}>Shops</Link>
            </div>
            <div>
              <Link to="/chats">Chats</Link>
            </div>
            <div>
              <Link to="/sell">Sell</Link>
            </div>
            {role === "admin" ? (
              <div>
                <Link to="/admin">Admin</Link>
              </div>
            ) : null}
            <div>
              <Link id={styles.registerNav} to="/profile">
                Profile
              </Link>
            </div>
          </div>
        ) : (
          <div id={styles.navLinks}>
            <div>
              <Link to="/shops" className={styles.shopsPill}>Shops</Link>
            </div>
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
    </>
  );
}

export default Home;
